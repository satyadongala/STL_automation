"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowOrchestrator = exports.LoopGuardError = void 0;
const test_1 = require("@playwright/test");
const db_1 = __importDefault(require("../db"));
const api_step_adapter_1 = require("./adapters/api-step-adapter");
const ui_step_adapter_1 = require("./adapters/ui-step-adapter");
const test_case_adapter_1 = require("./adapters/test-case-adapter");
const condition_evaluator_1 = require("./condition-evaluator");
const execution_context_1 = require("./execution-context");
const definition_validator_1 = require("./definition-validator");
const linear_to_definition_1 = require("./linear-to-definition");
const limits_1 = require("./limits");
const step_utils_1 = require("./step-utils");
const trace_reporter_1 = require("./trace-reporter");
const step_utils_2 = require("./step-utils");
const workflow_graph_utils_1 = require("./workflow-graph-utils");
class LoopGuardError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LoopGuardError';
    }
}
exports.LoopGuardError = LoopGuardError;
class WorkflowOrchestrator {
    static activeRuns = new Map();
    static kill(runId) {
        const controller = this.activeRuns.get(runId);
        if (controller) {
            controller.abort();
            this.activeRuns.delete(runId);
            return true;
        }
        return false;
    }
    static async execute(options) {
        const { runId, projectId, environmentId, workflowId, headed, onLog, onStatusChange } = options;
        const abortController = new AbortController();
        this.activeRuns.set(runId, abortController);
        const trace = new trace_reporter_1.TraceReporter(runId, onLog);
        const startTime = Date.now();
        let browser = null;
        let page = null;
        let apiContext = null;
        try {
            const workflow = await db_1.default.workflow.findUnique({
                where: { id: workflowId },
                include: { testCases: { orderBy: { sortOrder: 'asc' }, include: { testCase: true } } },
            });
            if (!workflow)
                throw new Error('Workflow not found');
            const project = await db_1.default.project.findUnique({ where: { id: projectId } });
            if (!project)
                throw new Error('Project not found');
            const environment = environmentId
                ? await db_1.default.environment.findUnique({ where: { id: environmentId } })
                : null;
            let definition = null;
            try {
                definition = (0, definition_validator_1.parseWorkflowDefinition)(workflow.definition);
            }
            catch {
                definition = null;
            }
            if (!definition || !(0, definition_validator_1.hasControlFlowDefinition)(workflow.definition)) {
                const ids = workflow.testCases.map((w) => w.testCaseId);
                if (ids.length === 0)
                    throw new Error('Workflow has no definition or test cases');
                definition = (0, linear_to_definition_1.buildLinearWorkflowDefinition)(workflow.id, workflow.name, ids);
            }
            const sharedMethods = await db_1.default.sharedMethod.findMany({ where: { projectId } });
            const baseUrl = environment?.baseUrl || project.baseUrl;
            const projectHeaders = (0, step_utils_1.parseJson)(project.defaultHeaders, {});
            const envHeaders = environment ? (0, step_utils_1.parseJson)(environment.headers, {}) : {};
            const mergedDefaultHeaders = { ...projectHeaders, ...envHeaders };
            const projectVariables = (0, step_utils_1.parseJson)(project.variables, {});
            const envVariables = environment ? (0, step_utils_1.parseJson)(environment.variables, {}) : {};
            const workflowVars = definition.variables || {};
            const ctx = execution_context_1.ExecutionContext.merge(projectVariables, envVariables, workflowVars);
            const needsBrowser = await resolveNeedsBrowser(definition.root, projectId);
            await db_1.default.executionRun.update({
                where: { id: runId },
                data: {
                    status: 'RUNNING',
                    startedAt: new Date(),
                    executionMode: 'WORKFLOW',
                    workflowDefinitionSnapshot: JSON.stringify(definition),
                },
            });
            if (onStatusChange)
                onStatusChange('RUNNING');
            trace.log(`[SYS] Workflow interpreter started: ${workflow.name}\n`);
            trace.log(`[SYS] Project type: ${project.projectType || 'API'}\n`);
            trace.log(`[SYS] Environment: ${environment?.name || 'Default'}\n`);
            if (needsBrowser) {
                trace.log(`[SYS] Browser: ${headed ? 'headed' : 'headless'}\n`);
            }
            apiContext = await test_1.request.newContext({ baseURL: baseUrl });
            if (needsBrowser) {
                browser = await test_1.chromium.launch({ headless: !headed });
                page = await browser.newPage();
            }
            const resources = {
                apiRequest: apiContext,
                page,
                sharedMethods,
                baseUrl,
                mergedDefaultHeaders,
            };
            const defaultOnFailure = definition.defaults?.onFailure || 'fail';
            const result = await this.executeNode(definition.root, ctx, resources, trace, runId, null, 0, defaultOnFailure, abortController.signal, definition.defaults?.maxLoopIterations);
            const durationMs = Date.now() - startTime;
            const failed = result === 'FAILED';
            const runStatus = failed ? 'FAILED' : 'COMPLETED';
            const spanStats = await db_1.default.executionSpan.groupBy({
                by: ['status'],
                where: { executionRunId: runId },
                _count: true,
            });
            let passedCount = 0;
            let failedCount = 0;
            for (const row of spanStats) {
                if (row.status === 'PASSED')
                    passedCount += row._count;
                if (row.status === 'FAILED')
                    failedCount += row._count;
            }
            await db_1.default.executionRun.update({
                where: { id: runId },
                data: {
                    status: runStatus,
                    completedAt: new Date(),
                    durationMs,
                    summaryPassed: passedCount,
                    summaryFailed: failedCount,
                    summaryTotal: passedCount + failedCount,
                },
            });
            trace.log(`\n[SYS] Workflow completed: ${runStatus}. Passed spans: ${passedCount}, Failed: ${failedCount}\n`);
            if (onStatusChange)
                onStatusChange(runStatus);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            trace.log(`\n[FATAL] Workflow execution failed: ${msg}\n`);
            await db_1.default.executionRun.update({
                where: { id: runId },
                data: { status: 'FAILED', completedAt: new Date(), rawLogs: msg },
            });
            if (onStatusChange)
                onStatusChange('FAILED');
        }
        finally {
            this.activeRuns.delete(runId);
            if (page)
                await page.close().catch(() => undefined);
            if (browser)
                await browser.close().catch(() => undefined);
            if (apiContext)
                await apiContext.dispose().catch(() => undefined);
        }
    }
    static checkAbort(signal) {
        if (signal.aborted)
            throw new Error('Execution aborted by user');
    }
    static async executeNode(node, ctx, resources, trace, runId, parentSpanId, depth, defaultOnFailure, signal, maxLoopIterations) {
        this.checkAbort(signal);
        if (depth > limits_1.WORKFLOW_LIMITS.maxNestingDepth) {
            throw new Error(`Max nesting depth ${limits_1.WORKFLOW_LIMITS.maxNestingDepth} exceeded`);
        }
        const onFailure = node.onFailure || defaultOnFailure;
        const spanId = await trace.startSpan({
            runId,
            parentSpanId,
            nodeId: node.id,
            nodeType: node.type,
            name: node.name || node.id,
        });
        try {
            let status = 'PASSED';
            let detail = {};
            switch (node.type) {
                case 'group':
                    for (const child of node.children || []) {
                        const childStatus = await this.executeNode(child, ctx, resources, trace, runId, spanId, depth + 1, defaultOnFailure, signal, maxLoopIterations);
                        if (childStatus === 'FAILED' && onFailure === 'fail') {
                            status = 'FAILED';
                            break;
                        }
                    }
                    break;
                case 'testCaseRef': {
                    const result = await (0, test_case_adapter_1.runTestCaseRef)(node.testCaseId, ctx, resources, node.parameterOverrides);
                    detail = { result };
                    status = result.status;
                    await this.recordTestCaseResult(runId, node.testCaseId, result);
                    break;
                }
                case 'step': {
                    let result;
                    if (node.stepKind === 'api') {
                        if (!node.api)
                            throw new Error(`API step ${node.id} missing api config`);
                        result = await (0, api_step_adapter_1.runApiStep)(node.api, ctx, resources, node.assertions, node.extractions);
                    }
                    else {
                        if (!node.ui)
                            throw new Error(`UI step ${node.id} missing ui config`);
                        result = await (0, ui_step_adapter_1.runUiSteps)([node.ui], '/', ctx, resources);
                    }
                    detail = { result };
                    status = result.status;
                    break;
                }
                case 'setVariable': {
                    const val = condition_evaluator_1.ConditionEvaluator.resolveValue(node.value, ctx, resources);
                    ctx.set(node.name, String(val ?? ''), node.scope || 'workflow');
                    detail = { variable: node.name, value: String(val ?? '') };
                    break;
                }
                case 'if': {
                    let chosen;
                    for (const branch of node.branches) {
                        if (branch.kind === 'else') {
                            chosen = branch;
                            break;
                        }
                        if (branch.condition && condition_evaluator_1.ConditionEvaluator.evaluate(branch.condition, ctx, resources)) {
                            chosen = branch;
                            break;
                        }
                    }
                    if (!chosen) {
                        status = 'SKIPPED';
                    }
                    else {
                        ctx.pushScope({}, 'loop');
                        for (const child of chosen.body || []) {
                            const childStatus = await this.executeNode(child, ctx, resources, trace, runId, spanId, depth + 1, defaultOnFailure, signal, maxLoopIterations);
                            if (childStatus === 'FAILED' && onFailure === 'fail') {
                                status = 'FAILED';
                                break;
                            }
                        }
                        ctx.popScope();
                    }
                    break;
                }
                case 'for': {
                    const from = (0, step_utils_2.coerceNumber)(condition_evaluator_1.ConditionEvaluator.resolveValue(node.iterator.from, ctx, resources));
                    const to = (0, step_utils_2.coerceNumber)(condition_evaluator_1.ConditionEvaluator.resolveValue(node.iterator.to, ctx, resources));
                    const stepVal = (0, step_utils_2.coerceNumber)(condition_evaluator_1.ConditionEvaluator.resolveValue(node.iterator.step ?? 1, ctx, resources), 1);
                    const indexVar = node.iterator.indexVariable || 'index';
                    const maxIter = maxLoopIterations ?? limits_1.WORKFLOW_LIMITS.maxLoopIterations;
                    const count = Math.ceil(Math.abs(to - from) / Math.abs(stepVal || 1));
                    if (count > maxIter)
                        throw new LoopGuardError(`for loop exceeds max iterations (${maxIter})`);
                    for (let i = from; stepVal > 0 ? i < to : i > to; i += stepVal) {
                        this.checkAbort(signal);
                        ctx.pushScope({ [indexVar]: String(i) }, 'loop');
                        for (const child of node.body || []) {
                            const childStatus = await this.executeNode(child, ctx, resources, trace, runId, spanId, depth + 1, defaultOnFailure, signal, maxLoopIterations);
                            if (childStatus === 'FAILED') {
                                if (onFailure === 'breakLoop')
                                    break;
                                if (onFailure === 'fail') {
                                    status = 'FAILED';
                                    break;
                                }
                            }
                        }
                        ctx.popScope();
                        if (status === 'FAILED' && onFailure === 'fail')
                            break;
                    }
                    break;
                }
                case 'forEach': {
                    const collection = condition_evaluator_1.ConditionEvaluator.resolveValue(node.iterator.collection, ctx, resources);
                    const items = Array.isArray(collection)
                        ? collection
                        : collection !== undefined && collection !== null
                            ? [collection]
                            : [];
                    const maxIter = maxLoopIterations ?? limits_1.WORKFLOW_LIMITS.maxLoopIterations;
                    if (items.length > maxIter)
                        throw new LoopGuardError(`forEach exceeds max iterations (${maxIter})`);
                    const itemVar = node.iterator.itemVariable || 'item';
                    const indexVar = node.iterator.indexVariable || 'index';
                    for (let index = 0; index < items.length; index++) {
                        this.checkAbort(signal);
                        const item = items[index];
                        ctx.pushScope({
                            [itemVar]: typeof item === 'object' ? JSON.stringify(item) : String(item),
                            [indexVar]: String(index),
                        }, 'loop');
                        for (const child of node.body || []) {
                            const childStatus = await this.executeNode(child, ctx, resources, trace, runId, spanId, depth + 1, defaultOnFailure, signal, maxLoopIterations);
                            if (childStatus === 'FAILED' && onFailure === 'fail') {
                                status = 'FAILED';
                                break;
                            }
                        }
                        ctx.popScope();
                        if (status === 'FAILED' && onFailure === 'fail')
                            break;
                    }
                    break;
                }
                case 'while': {
                    const maxWhile = node.maxIterations ?? limits_1.WORKFLOW_LIMITS.maxWhileIterationsPerNode;
                    let iterations = 0;
                    while (condition_evaluator_1.ConditionEvaluator.evaluate(node.condition, ctx, resources)) {
                        if (++iterations > maxWhile)
                            throw new LoopGuardError(`while loop exceeded max iterations (${maxWhile})`);
                        this.checkAbort(signal);
                        ctx.pushScope({ _iteration: String(iterations) }, 'loop');
                        for (const child of node.body || []) {
                            const childStatus = await this.executeNode(child, ctx, resources, trace, runId, spanId, depth + 1, defaultOnFailure, signal, maxLoopIterations);
                            if (childStatus === 'FAILED' && onFailure === 'fail') {
                                status = 'FAILED';
                                break;
                            }
                        }
                        ctx.popScope();
                        if (status === 'FAILED' && onFailure === 'fail')
                            break;
                    }
                    break;
                }
                default:
                    throw new Error(`Unknown node type: ${node.type}`);
            }
            await trace.endSpan(spanId, status, detail);
            return status;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await trace.endSpan(spanId, 'FAILED', {}, msg);
            if (onFailure === 'continue')
                return 'PASSED';
            throw err;
        }
    }
    static async recordTestCaseResult(runId, testCaseId, result) {
        await db_1.default.executionResult.create({
            data: {
                executionRunId: runId,
                testCaseId,
                status: result.status === 'PASSED' ? 'PASSED' : 'FAILED',
                durationMs: result.durationMs,
                requestSent: JSON.stringify(result.request || {}),
                responseReceived: JSON.stringify(result.response || {}),
                assertionResults: JSON.stringify(result.assertionResults || []),
                errorMessage: result.errorMessage || null,
            },
        });
    }
}
exports.WorkflowOrchestrator = WorkflowOrchestrator;
async function resolveNeedsBrowser(root, projectId) {
    if ((0, workflow_graph_utils_1.definitionHasUiSteps)(root))
        return true;
    const refIds = (0, workflow_graph_utils_1.collectTestCaseIds)(root);
    if (refIds.length === 0) {
        const project = await db_1.default.project.findUnique({ where: { id: projectId }, select: { projectType: true } });
        return project?.projectType === 'UI';
    }
    const testCases = await db_1.default.testCase.findMany({
        where: { id: { in: refIds } },
        select: { testType: true, method: true },
    });
    return testCases.some((tc) => tc.testType === 'UI' || tc.method === 'UI');
}
