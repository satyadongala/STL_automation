import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import prisma from '../db';
import { PlaywrightGenerator } from './playwright-generator';
import { ensurePlaywrightBrowsers } from './playwright-setup';
import { generateAllureReport } from './allure-report.service';
import { wsManager } from '../ws';
import { resolveHeaded, ensureVirtualDisplay, useXvfbRunWrapper } from '../utils/headed';

export interface RunOptions {
  runId: string;
  projectId: string;
  environmentId: string | null;
  workflowId?: string | null; // Optional: run test cases belonging to this workflow
  testCaseIds?: string[]; // Optional: if provided, run only these test cases
  grepPattern?: string; // Optional: grep pattern for execution
  headed?: boolean;
  workers?: number;
  onLog?: (log: string) => void;
  onStatusChange?: (status: string) => void;
}

const stripAnsi = (text: string) =>
  text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');

export class PlaywrightRunner {
  private static activeProcesses: Map<string, any> = new Map();

  public static async execute(options: RunOptions): Promise<void> {
    const { runId, projectId, environmentId, workflowId, testCaseIds, grepPattern, headed: headedRequested, workers, onLog, onStatusChange } = options;
    const headed = resolveHeaded(headedRequested);

    const tempDir = path.join(process.cwd(), 'temp_tests');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const specPath = path.join(tempDir, `run_${runId}.spec.ts`);
    const reportPath = path.join(tempDir, `report_${runId}.json`);
    const configPath = path.join(tempDir, `playwright.config.${runId}.ts`);
    const htmlReportDir = path.join(process.cwd(), 'reports', 'html', runId);
    const allureResultsDir = path.join(process.cwd(), 'reports', 'allure-results', runId);
    const allureReportDir = path.join(process.cwd(), 'reports', 'allure', runId);

    try {
      // 1. Fetch project and environment details
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });
      if (!project) throw new Error('Project not found');

      const environment = environmentId
        ? await prisma.environment.findUnique({ where: { id: environmentId } })
        : null;

      // 2. Fetch test cases (if workflowId is specified, fetch by workflow, else by testCaseIds, else all)
      let testCases: any[] = [];
      if (workflowId) {
        const workflowTestCases = await prisma.workflowTestCase.findMany({
          where: { workflowId },
          orderBy: { sortOrder: 'asc' },
          include: { testCase: true }
        });
        testCases = workflowTestCases.map(wtc => wtc.testCase);
      } else if (testCaseIds && testCaseIds.length > 0) {
        testCases = await prisma.testCase.findMany({
          where: {
            id: { in: testCaseIds },
            projectId: projectId
          },
          orderBy: { sortOrder: 'asc' }
        });
      } else {
        testCases = await prisma.testCase.findMany({
          where: { projectId: projectId },
          orderBy: { sortOrder: 'asc' }
        });
      }

      if (testCases.length === 0) {
        throw new Error('No test cases found for execution');
      }

      const needsBrowser =
        project.projectType === 'UI' ||
        testCases.some((tc) => tc.testType === 'UI' || tc.method === 'UI');

      if (needsBrowser) {
        await ensurePlaywrightBrowsers(onLog);
      }

      if (headed) {
        const display = await ensureVirtualDisplay(onLog);
        if (display && onLog) onLog(`[SYS] DISPLAY=${display}\n`);
      }

      // 3. Generate spec file content
      const sharedMethods = await prisma.sharedMethod.findMany({
        where: { projectId }
      });

      const specContent = PlaywrightGenerator.generateSpec(runId, project, environment, testCases, sharedMethods);
      fs.writeFileSync(specPath, specContent);

      // 4. Update run status to RUNNING in database
      await prisma.executionRun.update({
        where: { id: runId },
        data: { status: 'RUNNING', startedAt: new Date() }
      });
      if (onStatusChange) onStatusChange('RUNNING');

      // Log setup
      if (onLog) {
        onLog(`[SYS] Starting Playwright Test Execution. Spec: run_${runId}.spec.ts\n`);
        onLog(`[SYS] Browser mode: ${headed ? 'headed' : 'headless'}\n`);
        if (headed) {
          const proto = process.env.PUBLIC_URL?.startsWith('https') ? 'https' : 'http';
          const host = process.env.PUBLIC_URL?.replace(/^https?:\/\//, '') || `localhost:${process.env.PORT || 5001}`;
          onLog(`[SYS] Watch live browser: ${proto}://${host}/live-browser/vnc.html?autoconnect=true&resize=scale&path=websockify\n`);
        }
        onLog(`[SYS] Project: ${project.name}, Environment: ${environment?.name || 'Default'}\n`);
        onLog(`[SYS] Executing ${testCases.length} test case(s)...\n\n`);
      }

      // 5. Prepare per-run Playwright config (list + json + html + allure reporters)
      fs.mkdirSync(htmlReportDir, { recursive: true });
      fs.mkdirSync(allureResultsDir, { recursive: true });

      const uiTimeout = Number(process.env.UI_TEST_TIMEOUT_MS) || 120000;
      const navTimeout = Number(process.env.UI_NAV_TIMEOUT_MS) || 90000;

      const configContent = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: ${uiTimeout},
  expect: { timeout: 15000 },
  use: {
    navigationTimeout: ${navTimeout},
    actionTimeout: 30000,
    trace: ${headed ? "'on'" : "'retain-on-failure'"},
    screenshot: ${headed ? "'on'" : "'only-on-failure'"},
    video: ${headed ? "'on'" : "'off'"},
  },
  reporter: [
    ['list'],
    ['json', { outputFile: ${JSON.stringify(reportPath)} }],
    ['html', { outputFolder: ${JSON.stringify(htmlReportDir)}, open: 'never' }],
    ['allure-playwright', { resultsDir: ${JSON.stringify(allureResultsDir)}, detail: true, suiteTitle: true }],
  ],
});
`;
      fs.writeFileSync(configPath, configContent);

      const args = [
        'playwright',
        'test',
        specPath,
        `--config=${configPath}`,
        `--workers=${workers && workers > 0 ? workers : 1}`,
      ];

      if (headed) {
        args.push('--headed');
      }

      // Support grep pattern if provided
      if (grepPattern) {
        args.push('--grep', grepPattern);
        if (onLog) onLog(`[SYS] Applying grep filter: "${grepPattern}"\n`);
      } else if (testCaseIds && testCaseIds.length > 0) {
        // If specific test case IDs are requested, we can use a grep pattern matching the IDs
        const idsGrep = testCaseIds.join('|');
        args.push('--grep', idsGrep);
      }

      const runEnv: NodeJS.ProcessEnv = {
        ...process.env,
        NO_COLOR: '1',
        TERM: 'dumb',
      };
      delete runEnv.FORCE_COLOR;

      const startTime = Date.now();

      // 6. Spawn Playwright Process (xvfb-run wraps headed runs on Linux — most reliable in Docker)
      const useXvfb = useXvfbRunWrapper(headed);
      const spawnCmd = useXvfb ? 'xvfb-run' : 'npx';
      const spawnArgs = useXvfb
        ? ['-a', '--server-args=-screen 0 1920x1080x24', 'npx', ...args]
        : args;

      const child = spawn(spawnCmd, spawnArgs, { env: runEnv });
      this.activeProcesses.set(runId, child);

      let accumulatedLogs = '';

      child.stdout.on('data', (data) => {
        const str = stripAnsi(data.toString());
        accumulatedLogs += str;
        if (onLog) onLog(str);
      });

      child.stderr.on('data', (data) => {
        const str = stripAnsi(data.toString());
        accumulatedLogs += str;
        if (onLog) onLog(str);
      });

      child.on('close', async (code) => {
        const durationMs = Date.now() - startTime;
        this.activeProcesses.delete(runId);

        if (onLog) {
          onLog(`\n[SYS] Playwright execution completed with exit code: ${code}\n`);
          onLog(`[SYS] Analyzing test reports...\n`);
        }

        try {
          // 7. Parse the JSON report
          let reportData: any = {};
          if (fs.existsSync(reportPath)) {
            const reportRaw = fs.readFileSync(reportPath, 'utf8');
            try {
              reportData = JSON.parse(reportRaw);
            } catch (e: any) {
              if (onLog) onLog(`[ERROR] Failed to parse report JSON: ${e.message}\n`);
            }
          }

          // Gather results from reportData
          const executionResults: any[] = [];
          let passedCount = 0;
          let failedCount = 0;

          // Parse results out of Playwright JSON format
          if (reportData.suites) {
            const traverseSuites = (suite: any) => {
              if (suite.specs) {
                for (const spec of suite.specs) {
                  // The title is in the format "runId:testCaseId:TestCase Name"
                  const titleParts = spec.title.split(':');
                  const tcId = titleParts[1];

                  if (spec.tests && spec.tests.length > 0) {
                    const testResult = spec.tests[0].results?.[0];
                    if (testResult) {
                      const status = testResult.status === 'passed' ? 'PASSED' : 'FAILED';
                      if (status === 'PASSED') passedCount++;
                      else failedCount++;

                      const duration = testResult.duration || 0;
                      let reqResData = { request: null, response: null, error: null };
                      let assertionsData = [];
                      let errorMessage = null;

                      if (testResult.errors && testResult.errors.length > 0) {
                        errorMessage = testResult.errors.map((e: any) => e.message || e.value).join('\n');
                      }

                      // Decode attachments
                      if (testResult.attachments) {
                        for (const attachment of testResult.attachments) {
                          let bodyContent = '';
                          if (attachment.body) {
                            // In older/some versions, body is base64 encoded
                            bodyContent = Buffer.from(attachment.body, 'base64').toString('utf8');
                          } else if (attachment.path && fs.existsSync(attachment.path)) {
                            bodyContent = fs.readFileSync(attachment.path, 'utf8');
                          }

                          if (attachment.name === 'request_response' && bodyContent) {
                            try { reqResData = JSON.parse(bodyContent); } catch (e) {}
                          } else if (attachment.name === 'assertions' && bodyContent) {
                            try { assertionsData = JSON.parse(bodyContent); } catch (e) {}
                          }
                        }
                      }

                      executionResults.push({
                        testCaseId: tcId || testCases[0].id, // fallback
                        status,
                        durationMs: duration,
                        requestSent: JSON.stringify(reqResData.request || {}),
                        responseReceived: JSON.stringify(reqResData.response || {}),
                        assertionResults: JSON.stringify(assertionsData),
                        errorMessage: errorMessage || reqResData.error || null
                      });
                    }
                  }
                }
              }
              if (suite.suites) {
                for (const childSuite of suite.suites) {
                  traverseSuites(childSuite);
                }
              }
            };

            for (const suite of reportData.suites) {
              traverseSuites(suite);
            }
          }

          // If no test cases were traversed (e.g. build failure), fallback structure
          if (executionResults.length === 0) {
            for (const tc of testCases) {
              executionResults.push({
                testCaseId: tc.id,
                status: 'FAILED',
                durationMs: 0,
                requestSent: '{}',
                responseReceived: '{}',
                assertionResults: '[]',
                errorMessage: 'Playwright test failed to build or execute. Check logs.'
              });
            }
            failedCount = testCases.length;
          }

          // 8. Transactionally write results and update ExecutionRun status
          await prisma.$transaction(async (tx) => {
            // Write each result
            for (const result of executionResults) {
              await tx.executionResult.create({
                data: {
                  executionRunId: runId,
                  testCaseId: result.testCaseId,
                  status: result.status,
                  durationMs: result.durationMs,
                  requestSent: result.requestSent,
                  responseReceived: result.responseReceived,
                  assertionResults: result.assertionResults,
                  errorMessage: result.errorMessage
                }
              });
            }

            const runFinalStatus = failedCount > 0 ? 'FAILED' : 'COMPLETED';

            // Update Run summary
            await tx.executionRun.update({
              where: { id: runId },
              data: {
                status: runFinalStatus,
                completedAt: new Date(),
                summaryPassed: passedCount,
                summaryFailed: failedCount,
                summaryTotal: passedCount + failedCount,
                durationMs: durationMs,
                rawLogs: accumulatedLogs
              }
            });

            if (onStatusChange) onStatusChange(runFinalStatus);
          });

          if (onLog) {
            onLog(`[SYS] Execution analysis complete. Passed: ${passedCount}, Failed: ${failedCount}.\n`);
          }

          await generateAllureReport(allureResultsDir, allureReportDir, onLog);

          // ponytail: allow WS buffer cleanup after clients had time to read final status
          setTimeout(() => wsManager.clearRun(runId), 60_000);

        } catch (dbErr: any) {
          if (onLog) onLog(`[ERROR] Failed to save results to Database: ${dbErr.message}\n`);
          // Force update status to FAILED in case of save error
          await prisma.executionRun.update({
            where: { id: runId },
            data: { status: 'FAILED', rawLogs: accumulatedLogs + `\nDB Write Error: ${dbErr.message}` }
          });
          if (onStatusChange) onStatusChange('FAILED');
        } finally {
          // Cleanup temp files
          if (fs.existsSync(specPath)) fs.unlinkSync(specPath);
          if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
          if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
        }
      });

    } catch (err: any) {
      if (onLog) onLog(`\n[FATAL ERROR] Playwright Execution failed: ${err.message}\n`);
      // Update DB to failed
      await prisma.executionRun.update({
        where: { id: runId },
        data: { status: 'FAILED', rawLogs: `[FATAL] ${err.message}` }
      });
      if (onStatusChange) onStatusChange('FAILED');

      // Cleanup
      if (fs.existsSync(specPath)) fs.unlinkSync(specPath);
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
      if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    }
  }

  public static kill(runId: string): boolean {
    const process = this.activeProcesses.get(runId);
    if (process) {
      process.kill();
      this.activeProcesses.delete(runId);
      return true;
    }
    return false;
  }
}
