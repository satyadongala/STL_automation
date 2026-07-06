import type { WorkflowDefinition } from './types';

export function buildLinearWorkflowDefinition(
  workflowId: string,
  workflowName: string,
  testCaseIds: string[]
): WorkflowDefinition {
  return {
    schemaVersion: '1.0.0',
    id: workflowId,
    name: workflowName,
    root: {
      id: 'root',
      type: 'group',
      name: workflowName,
      children: testCaseIds.map((testCaseId, index) => ({
        id: `tc-ref-${index}`,
        type: 'testCaseRef' as const,
        name: `Step ${index + 1}`,
        testCaseId,
      })),
    },
  };
}
