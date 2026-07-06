import type { WorkflowNode } from './types';

/** Collect all testCaseRef IDs from a workflow tree (for browser / DB lookups). */
export function collectTestCaseIds(node: WorkflowNode): string[] {
  const ids: string[] = [];
  const walk = (n: WorkflowNode) => {
    if (n.type === 'testCaseRef') {
      ids.push(n.testCaseId);
    }
    if (n.type === 'group') {
      (n.children || []).forEach(walk);
    } else if (n.type === 'if') {
      n.branches.forEach((b) => (b.body || []).forEach(walk));
    } else if (n.type === 'for' || n.type === 'forEach' || n.type === 'while') {
      (n.body || []).forEach(walk);
    }
  };
  walk(node);
  return [...new Set(ids)];
}

export function definitionHasUiSteps(node: WorkflowNode): boolean {
  if (node.type === 'step' && node.stepKind === 'ui') return true;
  if (node.type === 'group') return (node.children || []).some(definitionHasUiSteps);
  if (node.type === 'if') return node.branches.some((b) => (b.body || []).some(definitionHasUiSteps));
  if (node.type === 'for' || node.type === 'forEach' || node.type === 'while') {
    return (node.body || []).some(definitionHasUiSteps);
  }
  return false;
}
