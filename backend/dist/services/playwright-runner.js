"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightRunner = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const db_1 = __importDefault(require("../db"));
const playwright_generator_1 = require("./playwright-generator");
const playwright_setup_1 = require("./playwright-setup");
const allure_report_service_1 = require("./allure-report.service");
const ws_1 = require("../ws");
const headed_1 = require("../utils/headed");
const playwright_artifacts_1 = require("../utils/playwright-artifacts");
const stripAnsi = (text) => text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
class PlaywrightRunner {
    static activeProcesses = new Map();
    static async execute(options) {
        const { runId, projectId, environmentId, workflowId, testCaseIds, grepPattern, headed: headedRequested, workers, video: videoRequested, trace: traceRequested, screenshot: screenshotRequested, onLog, onStatusChange } = options;
        const headed = (0, headed_1.resolveHeaded)(headedRequested);
        const videoMode = (0, playwright_artifacts_1.resolveArtifactMode)(videoRequested, headed ? 'on' : 'off');
        const traceMode = (0, playwright_artifacts_1.resolveArtifactMode)(traceRequested, headed ? 'on' : 'failed');
        const screenshotMode = (0, playwright_artifacts_1.resolveArtifactMode)(screenshotRequested, headed ? 'on' : 'failed');
        const tempDir = path.join(process.cwd(), 'temp_tests');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        let systemLogs = '';
        const sysLog = (msg) => {
            systemLogs += msg;
            if (onLog)
                onLog(msg);
        };
        const specPath = path.join(tempDir, `run_${runId}.spec.ts`);
        const reportPath = path.join(tempDir, `report_${runId}.json`);
        const configPath = path.join(tempDir, `playwright.config.${runId}.ts`);
        const htmlReportDir = path.join(process.cwd(), 'reports', 'html', runId);
        const allureResultsDir = path.join(process.cwd(), 'reports', 'allure-results', runId);
        const allureReportDir = path.join(process.cwd(), 'reports', 'allure', runId);
        try {
            // 1. Fetch project and environment details
            const project = await db_1.default.project.findUnique({
                where: { id: projectId }
            });
            if (!project)
                throw new Error('Project not found');
            const environment = environmentId
                ? await db_1.default.environment.findUnique({ where: { id: environmentId } })
                : null;
            // 2. Fetch test cases (if workflowId is specified, fetch by workflow, else by testCaseIds, else all)
            let testCases = [];
            if (workflowId) {
                const workflowTestCases = await db_1.default.workflowTestCase.findMany({
                    where: { workflowId },
                    orderBy: { sortOrder: 'asc' },
                    include: { testCase: true }
                });
                testCases = workflowTestCases.map(wtc => wtc.testCase);
            }
            else if (testCaseIds && testCaseIds.length > 0) {
                testCases = await db_1.default.testCase.findMany({
                    where: {
                        id: { in: testCaseIds },
                        projectId: projectId
                    },
                    orderBy: { sortOrder: 'asc' }
                });
            }
            else {
                testCases = await db_1.default.testCase.findMany({
                    where: { projectId: projectId },
                    orderBy: { sortOrder: 'asc' }
                });
            }
            if (testCases.length === 0) {
                throw new Error('No test cases found for execution');
            }
            const needsBrowser = project.projectType === 'UI' ||
                testCases.some((tc) => tc.testType === 'UI' || tc.method === 'UI');
            if (needsBrowser) {
                await (0, playwright_setup_1.ensurePlaywrightBrowsers)(sysLog);
            }
            if (headed) {
                const display = await (0, headed_1.ensureVirtualDisplay)(sysLog);
                if (display)
                    sysLog(`[SYS] DISPLAY=${display}\n`);
            }
            // 3. Generate spec file content
            const sharedMethods = await db_1.default.sharedMethod.findMany({
                where: { projectId }
            });
            const specContent = playwright_generator_1.PlaywrightGenerator.generateSpec(runId, project, environment, testCases, sharedMethods);
            fs.writeFileSync(specPath, specContent);
            // 4. Update run status to RUNNING in database
            await db_1.default.executionRun.update({
                where: { id: runId },
                data: { status: 'RUNNING', startedAt: new Date() }
            });
            if (onStatusChange)
                onStatusChange('RUNNING');
            // Log setup
            sysLog(`[SYS] Starting Playwright Test Execution. Spec: run_${runId}.spec.ts\n`);
            sysLog(`[SYS] Browser mode: ${headed ? 'headed' : 'headless'}\n`);
            if (headed) {
                const proto = process.env.PUBLIC_URL?.startsWith('https') ? 'https' : 'http';
                const host = process.env.PUBLIC_URL?.replace(/^https?:\/\//, '') || `localhost:${process.env.PORT || 5001}`;
                sysLog(`[SYS] Watch live browser: ${proto}://${host}/live-browser/vnc.html?autoconnect=true&resize=scale&path=websockify\n`);
            }
            sysLog(`[SYS] Project: ${project.name}, Environment: ${environment?.name || 'Default'}\n`);
            sysLog(`[SYS] Executing ${testCases.length} test case(s)...\n\n`);
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
    headless: ${headed ? 'false' : 'true'},
    navigationTimeout: ${navTimeout},
    actionTimeout: 30000,
    trace: '${(0, playwright_artifacts_1.toPlaywrightTrace)(traceMode)}',
    screenshot: '${(0, playwright_artifacts_1.toPlaywrightScreenshot)(screenshotMode)}',
    video: '${(0, playwright_artifacts_1.toPlaywrightVideo)(videoMode)}',
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
                sysLog(`[SYS] Applying grep filter: "${grepPattern}"\n`);
            }
            else if (testCaseIds && testCaseIds.length > 0) {
                // If specific test case IDs are requested, we can use a grep pattern matching the IDs
                const idsGrep = testCaseIds.join('|');
                args.push('--grep', idsGrep);
            }
            const runEnv = {
                ...process.env,
                NO_COLOR: '1',
                TERM: 'dumb',
            };
            delete runEnv.FORCE_COLOR;
            if (headed) {
                const display = process.env.DISPLAY || (await (0, headed_1.ensureVirtualDisplay)(sysLog));
                if (display) {
                    runEnv.DISPLAY = display;
                    sysLog(`[SYS] Chromium DISPLAY=${display}\n`);
                }
                // ponytail: Coolify/Docker often sets CI=1 which can interfere with headed runs
                delete runEnv.CI;
                delete runEnv.PLAYWRIGHT_HEADLESS;
            }
            const startTime = Date.now();
            // Use npx directly when DISPLAY is set (same screen as noVNC). xvfb-run -a uses a different display.
            const useXvfb = (0, headed_1.useXvfbRunWrapper)(headed);
            sysLog(`[SYS] Spawn: ${useXvfb ? 'xvfb-run' : 'npx'}${headed ? ' --headed' : ''}\n`);
            const spawnCmd = useXvfb ? 'xvfb-run' : 'npx';
            const spawnArgs = useXvfb
                ? ['-a', '--server-args=-screen 0 1920x1080x24', 'npx', ...args]
                : args;
            const child = (0, child_process_1.spawn)(spawnCmd, spawnArgs, { env: runEnv });
            this.activeProcesses.set(runId, child);
            let accumulatedLogs = '';
            child.stdout.on('data', (data) => {
                const str = stripAnsi(data.toString());
                accumulatedLogs += str;
                if (onLog)
                    onLog(str);
            });
            child.stderr.on('data', (data) => {
                const str = stripAnsi(data.toString());
                accumulatedLogs += str;
                if (onLog)
                    onLog(str);
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
                    let reportData = {};
                    if (fs.existsSync(reportPath)) {
                        const reportRaw = fs.readFileSync(reportPath, 'utf8');
                        try {
                            reportData = JSON.parse(reportRaw);
                        }
                        catch (e) {
                            if (onLog)
                                onLog(`[ERROR] Failed to parse report JSON: ${e.message}\n`);
                        }
                    }
                    // Gather results from reportData
                    const executionResults = [];
                    let passedCount = 0;
                    let failedCount = 0;
                    // Parse results out of Playwright JSON format
                    if (reportData.suites) {
                        const traverseSuites = (suite) => {
                            if (suite.specs) {
                                for (const spec of suite.specs) {
                                    // The title is in the format "runId:testCaseId:TestCase Name"
                                    const titleParts = spec.title.split(':');
                                    const tcId = titleParts[1];
                                    if (spec.tests && spec.tests.length > 0) {
                                        const testResult = spec.tests[0].results?.[0];
                                        if (testResult) {
                                            const status = testResult.status === 'passed' ? 'PASSED' : 'FAILED';
                                            if (status === 'PASSED')
                                                passedCount++;
                                            else
                                                failedCount++;
                                            const duration = testResult.duration || 0;
                                            let reqResData = { request: null, response: null, error: null };
                                            let assertionsData = [];
                                            let errorMessage = null;
                                            if (testResult.errors && testResult.errors.length > 0) {
                                                errorMessage = testResult.errors.map((e) => e.message || e.value).join('\n');
                                            }
                                            // Decode attachments
                                            if (testResult.attachments) {
                                                for (const attachment of testResult.attachments) {
                                                    let bodyContent = '';
                                                    if (attachment.body) {
                                                        // In older/some versions, body is base64 encoded
                                                        bodyContent = Buffer.from(attachment.body, 'base64').toString('utf8');
                                                    }
                                                    else if (attachment.path && fs.existsSync(attachment.path)) {
                                                        bodyContent = fs.readFileSync(attachment.path, 'utf8');
                                                    }
                                                    if (attachment.name === 'request_response' && bodyContent) {
                                                        try {
                                                            reqResData = JSON.parse(bodyContent);
                                                        }
                                                        catch (e) { }
                                                    }
                                                    else if (attachment.name === 'assertions' && bodyContent) {
                                                        try {
                                                            assertionsData = JSON.parse(bodyContent);
                                                        }
                                                        catch (e) { }
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
                    await db_1.default.$transaction(async (tx) => {
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
                                rawLogs: systemLogs + accumulatedLogs
                            }
                        });
                        if (onStatusChange)
                            onStatusChange(runFinalStatus);
                    });
                    if (onLog) {
                        onLog(`[SYS] Execution analysis complete. Passed: ${passedCount}, Failed: ${failedCount}.\n`);
                    }
                    await (0, allure_report_service_1.generateAllureReport)(allureResultsDir, allureReportDir, onLog);
                    // ponytail: allow WS buffer cleanup after clients had time to read final status
                    setTimeout(() => ws_1.wsManager.clearRun(runId), 60_000);
                }
                catch (dbErr) {
                    if (onLog)
                        onLog(`[ERROR] Failed to save results to Database: ${dbErr.message}\n`);
                    // Force update status to FAILED in case of save error
                    await db_1.default.executionRun.update({
                        where: { id: runId },
                        data: { status: 'FAILED', rawLogs: systemLogs + accumulatedLogs + `\nDB Write Error: ${dbErr.message}` }
                    });
                    if (onStatusChange)
                        onStatusChange('FAILED');
                }
                finally {
                    // Cleanup temp files
                    if (fs.existsSync(specPath))
                        fs.unlinkSync(specPath);
                    if (fs.existsSync(reportPath))
                        fs.unlinkSync(reportPath);
                    if (fs.existsSync(configPath))
                        fs.unlinkSync(configPath);
                }
            });
        }
        catch (err) {
            if (onLog)
                onLog(`\n[FATAL ERROR] Playwright Execution failed: ${err.message}\n`);
            // Update DB to failed
            await db_1.default.executionRun.update({
                where: { id: runId },
                data: { status: 'FAILED', rawLogs: systemLogs + `[FATAL] ${err.message}` }
            });
            if (onStatusChange)
                onStatusChange('FAILED');
            // Cleanup
            if (fs.existsSync(specPath))
                fs.unlinkSync(specPath);
            if (fs.existsSync(reportPath))
                fs.unlinkSync(reportPath);
            if (fs.existsSync(configPath))
                fs.unlinkSync(configPath);
        }
    }
    static kill(runId) {
        const process = this.activeProcesses.get(runId);
        if (process) {
            process.kill();
            this.activeProcesses.delete(runId);
            return true;
        }
        return false;
    }
}
exports.PlaywrightRunner = PlaywrightRunner;
