import prisma from '../../db';
import type { RuntimeResources, StepResult } from '../types';
import { ExecutionContext } from '../execution-context';
import { resolveVariables } from '../step-utils';
import { runApiTestCase } from './api-step-adapter';
import { runUiTestCase } from './ui-step-adapter';

export async function runTestCaseRef(
  testCaseId: string,
  ctx: ExecutionContext,
  resources: RuntimeResources,
  parameterOverrides: Record<string, string> = {}
): Promise<StepResult> {
  const testCase = await prisma.testCase.findUnique({ where: { id: testCaseId } });
  if (!testCase) {
    return { status: 'FAILED', durationMs: 0, errorMessage: `Test case ${testCaseId} not found` };
  }

  const resolvedOverrides: Record<string, string> = {};
  for (const [k, v] of Object.entries(parameterOverrides)) {
    resolvedOverrides[k] = resolveVariables(v, ctx.getSnapshot());
  }
  ctx.applyOverrides(resolvedOverrides);

  const isUi = testCase.testType === 'UI' || testCase.method === 'UI';
  if (isUi) {
    return runUiTestCase(testCase, ctx, resources);
  }
  return runApiTestCase(testCase, ctx, resources);
}
