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
class PlaywrightRunner {
    static activeProcesses = new Map();
    static async execute(options) {
        const { runId, projectId, environmentId, workflowId, testCaseIds, grepPattern, headed, workers, onLog, onStatusChange } = options;
        const tempDir = path.join(process.cwd(), 'temp_tests');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const specPath = path.join(tempDir, `run_${runId}.spec.ts`);
        const reportPath = path.join(tempDir, `report_${runId}.json`);
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
            if (onLog) {
                onLog(`[SYS] Starting Playwright Test Execution. Spec: run_${runId}.spec.ts\n`);
                onLog(`[SYS] Project: ${project.name}, Environment: ${environment?.name || 'Default'}\n`);
                onLog(`[SYS] Executing ${testCases.length} test case(s)...\n\n`);
            }
            // 5. Prepare execution arguments
            const args = [
                'playwright',
                'test',
                specPath,
                '--reporter=list,json,html',
                `--workers=${workers && workers > 0 ? workers : 1}`
            ];
            if (headed) {
                args.push('--headed');
            }
            // Support grep pattern if provided
            if (grepPattern) {
                args.push('--grep', grepPattern);
                if (onLog)
                    onLog(`[SYS] Applying grep filter: "${grepPattern}"\n`);
            }
            else if (testCaseIds && testCaseIds.length > 0) {
                // If specific test case IDs are requested, we can use a grep pattern matching the IDs
                const idsGrep = testCaseIds.join('|');
                args.push('--grep', idsGrep);
            }
            const htmlReportDir = path.join(process.cwd(), 'reports', 'html', runId);
            // Set environment variable for Playwright JSON output path
            const runEnv = {
                ...process.env,
                PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
                PLAYWRIGHT_HTML_REPORT: htmlReportDir,
                FORCE_COLOR: '1' // Force color outputs in logs
            };
            const startTime = Date.now();
            // 6. Spawn Playwright Process
            const child = (0, child_process_1.spawn)('npx', args, { env: runEnv });
            this.activeProcesses.set(runId, child);
            let accumulatedLogs = '';
            child.stdout.on('data', (data) => {
                const str = data.toString();
                accumulatedLogs += str;
                if (onLog)
                    onLog(str);
            });
            child.stderr.on('data', (data) => {
                const str = data.toString();
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
                                rawLogs: accumulatedLogs
                            }
                        });
                        if (onStatusChange)
                            onStatusChange(runFinalStatus);
                    });
                    if (onLog) {
                        onLog(`[SYS] Execution analysis complete. Passed: ${passedCount}, Failed: ${failedCount}.\n`);
                    }
                }
                catch (dbErr) {
                    if (onLog)
                        onLog(`[ERROR] Failed to save results to Database: ${dbErr.message}\n`);
                    // Force update status to FAILED in case of save error
                    await db_1.default.executionRun.update({
                        where: { id: runId },
                        data: { status: 'FAILED', rawLogs: accumulatedLogs + `\nDB Write Error: ${dbErr.message}` }
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
                }
            });
        }
        catch (err) {
            if (onLog)
                onLog(`\n[FATAL ERROR] Playwright Execution failed: ${err.message}\n`);
            // Update DB to failed
            await db_1.default.executionRun.update({
                where: { id: runId },
                data: { status: 'FAILED', rawLogs: `[FATAL] ${err.message}` }
            });
            if (onStatusChange)
                onStatusChange('FAILED');
            // Cleanup
            if (fs.existsSync(specPath))
                fs.unlinkSync(specPath);
            if (fs.existsSync(reportPath))
                fs.unlinkSync(reportPath);
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
