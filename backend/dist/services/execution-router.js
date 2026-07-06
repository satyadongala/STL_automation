"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startExecution = startExecution;
exports.stopExecution = stopExecution;
const playwright_runner_1 = require("./playwright-runner");
const workflow_orchestrator_1 = require("../workflow/workflow-orchestrator");
const definition_validator_1 = require("../workflow/definition-validator");
function runWorkflowOrchestrator(params) {
    workflow_orchestrator_1.WorkflowOrchestrator.execute({
        runId: params.runId,
        projectId: params.projectId,
        environmentId: params.environmentId,
        workflowId: params.workflowId,
        headed: params.headed,
        onLog: params.onLog,
        onStatusChange: params.onStatusChange,
    }).catch((err) => console.error(`Workflow execution error ${params.runId}:`, err));
}
function startExecution(params) {
    const useWorkflowEngine = params.workflowId &&
        params.workflowDefinition !== undefined &&
        (0, definition_validator_1.hasControlFlowDefinition)(params.workflowDefinition);
    if (useWorkflowEngine && params.workflowId) {
        runWorkflowOrchestrator(params);
        return;
    }
    playwright_runner_1.PlaywrightRunner.execute({
        runId: params.runId,
        projectId: params.projectId,
        environmentId: params.environmentId,
        workflowId: params.workflowId,
        testCaseIds: params.testCaseIds,
        grepPattern: params.grepPattern,
        headed: params.headed,
        workers: params.workers,
        onLog: params.onLog,
        onStatusChange: params.onStatusChange,
    }).catch((err) => console.error(`Playwright execution error ${params.runId}:`, err));
}
function stopExecution(runId) {
    return playwright_runner_1.PlaywrightRunner.kill(runId) || workflow_orchestrator_1.WorkflowOrchestrator.kill(runId);
}
