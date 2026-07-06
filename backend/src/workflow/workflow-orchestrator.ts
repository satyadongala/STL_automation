import { chromium, request } from '@playwright/test';
import prisma from '../db';
import { wsManager } from '../ws';
import { runApiStep } from './adapters/api-step-adapter';
import { runUiSteps } from './adapters/ui-step-adapter';
import { runTestCaseRef } from './adapters/test-case-adapter';
import { ConditionEvaluator } from './condition-evaluator';
import { ExecutionContext } from './execution-context';
import { hasControlFlowDefinition, parseWorkflowDefinition } from './definition-validator';
import { buildLinearWorkflowDefinition } from './linear-to-definition';
import { WORKFLOW_LIMITS } from './limits';
import { parseJson } from './step-utils';
import { TraceReporter } from './trace-reporter';
import type {
  OnFailurePolicy,
  RuntimeResources,
  StepResult,
  StepStatus,
  WorkflowDefinition,
  WorkflowNode,
} from './types';
import { coerceNumber } from './step-utils';
import { collectTestCaseIds, definitionHasUiSteps } from './workflow-graph-utils';
import { ensurePlaywrightBrowsers } from '../services/playwright-setup';

export interface WorkflowRunOptions {
  runId: string;
  projectId: string;
  environmentId: string | null;
  workflowId: string;
  headed?: boolean;
  onLog?: (log: string) => void;
  onStatusChange?: (status: string) => void;
}

export class LoopGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoopGuardError';
  }
}

export class WorkflowOrchestrator {
  private static activeRuns: Map<string, AbortController> = new Map();

  public static kill(runId: string): boolean {
    const controller = this.activeRuns.get(runId);
    if (controller) {
      controller.abort();
      this.activeRuns.delete(runId);
      return true;
    }
    return false;
  }

  public static async execute(options: WorkflowRunOptions): Promise<void> {
    const { runId, projectId, environmentId, workflowId, headed, onLog, onStatusChange } = options;
    const abortController = new AbortController();
    this.activeRuns.set(runId, abortController);

    const trace = new TraceReporter(runId, onLog);
    const startTime = Date.now();
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    let page: RuntimeResources['page'] = null;
    let apiContext: RuntimeResources['apiRequest'] | null = null;

    try {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { testCases: { orderBy: { sortOrder: 'asc' }, include: { testCase: true } } },
      });
      if (!workflow) throw new Error('Workflow not found');

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) throw new Error('Project not found');

      const environment = environmentId
        ? await prisma.environment.findUnique({ where: { id: environmentId } })
        : null;

      let definition: WorkflowDefinition | null = null;
      try {
        definition = parseWorkflowDefinition(workflow.definition);
      } catch {
        definition = null;
      }

      if (!definition || !hasControlFlowDefinition(workflow.definition)) {
        const ids = workflow.testCases.map((w) => w.testCaseId);
        if (ids.length === 0) throw new Error('Workflow has no definition or test cases');
        definition = buildLinearWorkflowDefinition(workflow.id, workflow.name, ids);
      }

      const sharedMethods = await prisma.sharedMethod.findMany({ where: { projectId } });
      const baseUrl = environment?.baseUrl || project.baseUrl;
      const projectHeaders = parseJson<Record<string, string>>(project.defaultHeaders, {});
      const envHeaders = environment ? parseJson<Record<string, string>>(environment.headers, {}) : {};
      const mergedDefaultHeaders = { ...projectHeaders, ...envHeaders };
      const projectVariables = parseJson<Record<string, string>>(project.variables, {});
      const envVariables = environment ? parseJson<Record<string, string>>(environment.variables, {}) : {};
      const workflowVars = definition.variables || {};

      const ctx = ExecutionContext.merge(projectVariables, envVariables, workflowVars);

      const needsBrowser = await resolveNeedsBrowser(definition.root, projectId);

      await prisma.executionRun.update({
        where: { id: runId },
        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          executionMode: 'WORKFLOW',
          workflowDefinitionSnapshot: JSON.stringify(definition),
        },
      });
      if (onStatusChange) onStatusChange('RUNNING');

      trace.log(`[SYS] Workflow interpreter started: ${workflow.name}\n`);
      trace.log(`[SYS] Project type: ${project.projectType || 'API'}\n`);
      trace.log(`[SYS] Environment: ${environment?.name || 'Default'}\n`);
      if (needsBrowser) {
        trace.log(`[SYS] Browser: ${headed ? 'headed' : 'headless'}\n`);
      }

      apiContext = await request.newContext({ baseURL: baseUrl });
      if (needsBrowser) {
        await ensurePlaywrightBrowsers(onLog);
        browser = await chromium.launch({ headless: !headed });
        page = await browser.newPage();
      }

      const resources: RuntimeResources = {
        apiRequest: apiContext,
        page,
        sharedMethods,
        baseUrl,
        mergedDefaultHeaders,
      };

      const defaultOnFailure = definition.defaults?.onFailure || 'fail';
      const result = await this.executeNode(
        definition.root,
        ctx,
        resources,
        trace,
        runId,
        null,
        0,
        defaultOnFailure,
        abortController.signal,
        definition.defaults?.maxLoopIterations
      );

      const durationMs = Date.now() - startTime;
      const failed = result === 'FAILED';
      const runStatus = failed ? 'FAILED' : 'COMPLETED';

      const spanStats = await prisma.executionSpan.groupBy({
        by: ['status'],
        where: { executionRunId: runId },
        _count: true,
      });

      let passedCount = 0;
      let failedCount = 0;
      for (const row of spanStats) {
        if (row.status === 'PASSED') passedCount += row._count;
        if (row.status === 'FAILED') failedCount += row._count;
      }

      await prisma.executionRun.update({
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
      if (onStatusChange) onStatusChange(runStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      trace.log(`\n[FATAL] Workflow execution failed: ${msg}\n`);
      await prisma.executionRun.update({
        where: { id: runId },
        data: { status: 'FAILED', completedAt: new Date(), rawLogs: msg },
      });
      if (onStatusChange) onStatusChange('FAILED');
    } finally {
      this.activeRuns.delete(runId);
      if (page) await page.close().catch(() => undefined);
      if (browser) await browser.close().catch(() => undefined);
      if (apiContext) await apiContext.dispose().catch(() => undefined);
    }
  }

  private static checkAbort(signal: AbortSignal): void {
    if (signal.aborted) throw new Error('Execution aborted by user');
  }

  private static async executeNode(
    node: WorkflowNode,
    ctx: ExecutionContext,
    resources: RuntimeResources,
    trace: TraceReporter,
    runId: string,
    parentSpanId: string | null,
    depth: number,
    defaultOnFailure: OnFailurePolicy,
    signal: AbortSignal,
    maxLoopIterations?: number
  ): Promise<StepStatus> {
    this.checkAbort(signal);
    if (depth > WORKFLOW_LIMITS.maxNestingDepth) {
      throw new Error(`Max nesting depth ${WORKFLOW_LIMITS.maxNestingDepth} exceeded`);
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
      let status: StepStatus = 'PASSED';
      let detail: Record<string, unknown> = {};

      switch (node.type) {
        case 'group':
          for (const child of node.children || []) {
            const childStatus = await this.executeNode(
              child,
              ctx,
              resources,
              trace,
              runId,
              spanId,
              depth + 1,
              defaultOnFailure,
              signal,
              maxLoopIterations
            );
            if (childStatus === 'FAILED' && onFailure === 'fail') {
              status = 'FAILED';
              break;
            }
          }
          break;

        case 'testCaseRef': {
          const result = await runTestCaseRef(node.testCaseId, ctx, resources, node.parameterOverrides);
          detail = { result };
          status = result.status;
          await this.recordTestCaseResult(runId, node.testCaseId, result);
          break;
        }

        case 'step': {
          let result: StepResult;
          if (node.stepKind === 'api') {
            if (!node.api) throw new Error(`API step ${node.id} missing api config`);
            result = await runApiStep(node.api, ctx, resources, node.assertions, node.extractions);
          } else {
            if (!node.ui) throw new Error(`UI step ${node.id} missing ui config`);
            result = await runUiSteps([node.ui], '/', ctx, resources);
          }
          detail = { result };
          status = result.status;
          break;
        }

        case 'setVariable': {
          const val = ConditionEvaluator.resolveValue(node.value, ctx, resources);
          ctx.set(node.name, String(val ?? ''), node.scope || 'workflow');
          detail = { variable: node.name, value: String(val ?? '') };
          break;
        }

        case 'if': {
          let chosen: (typeof node.branches)[0] | undefined;
          for (const branch of node.branches) {
            if (branch.kind === 'else') {
              chosen = branch;
              break;
            }
            if (branch.condition && ConditionEvaluator.evaluate(branch.condition, ctx, resources)) {
              chosen = branch;
              break;
            }
          }
          if (!chosen) {
            status = 'SKIPPED';
          } else {
            ctx.pushScope({}, 'loop');
            for (const child of chosen.body || []) {
              const childStatus = await this.executeNode(
                child,
                ctx,
                resources,
                trace,
                runId,
                spanId,
                depth + 1,
                defaultOnFailure,
                signal,
                maxLoopIterations
              );
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
          const from = coerceNumber(ConditionEvaluator.resolveValue(node.iterator.from, ctx, resources));
          const to = coerceNumber(ConditionEvaluator.resolveValue(node.iterator.to, ctx, resources));
          const stepVal = coerceNumber(
            ConditionEvaluator.resolveValue(node.iterator.step ?? 1, ctx, resources),
            1
          );
          const indexVar = node.iterator.indexVariable || 'index';
          const maxIter = maxLoopIterations ?? WORKFLOW_LIMITS.maxLoopIterations;
          const count = Math.ceil(Math.abs(to - from) / Math.abs(stepVal || 1));
          if (count > maxIter) throw new LoopGuardError(`for loop exceeds max iterations (${maxIter})`);

          for (let i = from; stepVal > 0 ? i < to : i > to; i += stepVal) {
            this.checkAbort(signal);
            ctx.pushScope({ [indexVar]: String(i) }, 'loop');
            for (const child of node.body || []) {
              const childStatus = await this.executeNode(
                child,
                ctx,
                resources,
                trace,
                runId,
                spanId,
                depth + 1,
                defaultOnFailure,
                signal,
                maxLoopIterations
              );
              if (childStatus === 'FAILED') {
                if (onFailure === 'breakLoop') break;
                if (onFailure === 'fail') {
                  status = 'FAILED';
                  break;
                }
              }
            }
            ctx.popScope();
            if (status === 'FAILED' && onFailure === 'fail') break;
          }
          break;
        }

        case 'forEach': {
          const collection = ConditionEvaluator.resolveValue(node.iterator.collection, ctx, resources);
          const items = Array.isArray(collection)
            ? collection
            : collection !== undefined && collection !== null
              ? [collection]
              : [];
          const maxIter = maxLoopIterations ?? WORKFLOW_LIMITS.maxLoopIterations;
          if (items.length > maxIter) throw new LoopGuardError(`forEach exceeds max iterations (${maxIter})`);

          const itemVar = node.iterator.itemVariable || 'item';
          const indexVar = node.iterator.indexVariable || 'index';

          for (let index = 0; index < items.length; index++) {
            this.checkAbort(signal);
            const item = items[index];
            ctx.pushScope(
              {
                [itemVar]: typeof item === 'object' ? JSON.stringify(item) : String(item),
                [indexVar]: String(index),
              },
              'loop'
            );
            for (const child of node.body || []) {
              const childStatus = await this.executeNode(
                child,
                ctx,
                resources,
                trace,
                runId,
                spanId,
                depth + 1,
                defaultOnFailure,
                signal,
                maxLoopIterations
              );
              if (childStatus === 'FAILED' && onFailure === 'fail') {
                status = 'FAILED';
                break;
              }
            }
            ctx.popScope();
            if (status === 'FAILED' && onFailure === 'fail') break;
          }
          break;
        }

        case 'while': {
          const maxWhile = node.maxIterations ?? WORKFLOW_LIMITS.maxWhileIterationsPerNode;
          let iterations = 0;
          while (ConditionEvaluator.evaluate(node.condition, ctx, resources)) {
            if (++iterations > maxWhile) throw new LoopGuardError(`while loop exceeded max iterations (${maxWhile})`);
            this.checkAbort(signal);
            ctx.pushScope({ _iteration: String(iterations) }, 'loop');
            for (const child of node.body || []) {
              const childStatus = await this.executeNode(
                child,
                ctx,
                resources,
                trace,
                runId,
                spanId,
                depth + 1,
                defaultOnFailure,
                signal,
                maxLoopIterations
              );
              if (childStatus === 'FAILED' && onFailure === 'fail') {
                status = 'FAILED';
                break;
              }
            }
            ctx.popScope();
            if (status === 'FAILED' && onFailure === 'fail') break;
          }
          break;
        }

        default:
          throw new Error(`Unknown node type: ${(node as WorkflowNode).type}`);
      }

      await trace.endSpan(spanId, status, detail);
      return status;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await trace.endSpan(spanId, 'FAILED', {}, msg);
      if (onFailure === 'continue') return 'PASSED';
      throw err;
    }
  }

  private static async recordTestCaseResult(runId: string, testCaseId: string, result: StepResult): Promise<void> {
    await prisma.executionResult.create({
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

async function resolveNeedsBrowser(root: WorkflowNode, projectId: string): Promise<boolean> {
  if (definitionHasUiSteps(root)) return true;

  const refIds = collectTestCaseIds(root);
  if (refIds.length === 0) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { projectType: true } });
    return project?.projectType === 'UI';
  }

  const testCases = await prisma.testCase.findMany({
    where: { id: { in: refIds } },
    select: { testType: true, method: true },
  });
  return testCases.some((tc) => tc.testType === 'UI' || tc.method === 'UI');
}
