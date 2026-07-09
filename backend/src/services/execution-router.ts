import { PlaywrightRunner } from './playwright-runner';
import { WorkflowOrchestrator } from '../workflow/workflow-orchestrator';
import { hasControlFlowDefinition } from '../workflow/definition-validator';

export interface StartExecutionParams {
  runId: string;
  projectId: string;
  environmentId: string | null;
  workflowId?: string | null;
  workflowDefinition?: string | null;
  testCaseIds?: string[];
  grepPattern?: string;
  headed?: boolean;
  workers?: number;
  video?: 'on' | 'off' | 'failed';
  trace?: 'on' | 'off' | 'failed';
  screenshot?: 'on' | 'off' | 'failed';
  onLog?: (log: string) => void;
  onStatusChange?: (status: string) => void;
}

function runWorkflowOrchestrator(params: StartExecutionParams): void {
  WorkflowOrchestrator.execute({
    runId: params.runId,
    projectId: params.projectId,
    environmentId: params.environmentId,
    workflowId: params.workflowId!,
    headed: params.headed,
    onLog: params.onLog,
    onStatusChange: params.onStatusChange,
  }).catch((err) => console.error(`Workflow execution error ${params.runId}:`, err));
}

export function startExecution(params: StartExecutionParams): void {
  const useWorkflowEngine =
    params.workflowId &&
    params.workflowDefinition !== undefined &&
    hasControlFlowDefinition(params.workflowDefinition);

  if (useWorkflowEngine && params.workflowId) {
    runWorkflowOrchestrator(params);
    return;
  }

  PlaywrightRunner.execute({
    runId: params.runId,
    projectId: params.projectId,
    environmentId: params.environmentId,
    workflowId: params.workflowId,
    testCaseIds: params.testCaseIds,
    grepPattern: params.grepPattern,
    headed: params.headed,
    workers: params.workers,
    video: params.video,
    trace: params.trace,
    screenshot: params.screenshot,
    onLog: params.onLog,
    onStatusChange: params.onStatusChange,
  }).catch((err) => console.error(`Playwright execution error ${params.runId}:`, err));
}

export function stopExecution(runId: string): boolean {
  return PlaywrightRunner.kill(runId) || WorkflowOrchestrator.kill(runId);
}
