import { expect } from '@playwright/test';
import type { RuntimeResources, SharedMethodRecord, StepResult, UiStepConfig } from '../types';
import { ExecutionContext } from '../execution-context';
import { WORKFLOW_LIMITS } from '../limits';
import { buildUrl, getLocator, parseJson, resolveVariables } from '../step-utils';

export async function runUiSteps(
  steps: UiStepConfig[],
  startPath: string,
  ctx: ExecutionContext,
  resources: RuntimeResources
): Promise<StepResult> {
  const page = resources.page;
  if (!page) {
    return { status: 'FAILED', durationMs: 0, errorMessage: 'Browser page is not available for UI steps' };
  }

  const vars = ctx.getSnapshot();
  const startUrl = buildUrl(resources.baseUrl, startPath, vars);
  const stepResults: unknown[] = [];
  const startedAt = Date.now();

  try {
    await page.goto(startUrl);
    const flatSteps = flattenUiSteps(steps, resources.sharedMethods);

    for (const [index, step] of flatSteps.entries()) {
      const action = step.action;
      const selector = step.selector ? resolveVariables(step.selector, ctx.getSnapshot()) : '';
      const value = step.value ? resolveVariables(step.value, ctx.getSnapshot()) : '';
      const variableName = step.variableName || '';
      const label = step.label || `${index + 1}. ${action}`;
      let actualValue: unknown = null;

      try {
        const locator = getLocator(page, step);
        if (action === 'goto') {
          await page.goto(buildUrl(resources.baseUrl, value || startPath, ctx.getSnapshot()));
          actualValue = page.url();
        } else if (action === 'click') {
          await locator.click();
        } else if (action === 'fill') {
          await locator.fill(value);
        } else if (action === 'select') {
          await locator.selectOption(value);
        } else if (action === 'check') {
          await locator.check();
        } else if (action === 'uncheck') {
          await locator.uncheck();
        } else if (action === 'wait_for_selector') {
          await locator.waitFor({ state: 'visible' });
        } else if (action === 'expect_visible') {
          await expect(locator).toBeVisible();
        } else if (action === 'expect_text') {
          await expect(locator).toContainText(value);
          actualValue = await locator.innerText().catch(() => null);
        } else if (action === 'expect_url') {
          await expect(page).toHaveURL(new RegExp(value));
          actualValue = page.url();
        } else if (action === 'extract_text') {
          actualValue = await locator.innerText();
          if (variableName) ctx.set(variableName, String(actualValue), 'workflow');
        } else if (action === 'screenshot') {
          // no-op in interpreter mode without testInfo
        } else {
          throw new Error(`Unsupported UI action: ${action}`);
        }

        stepResults.push({ type: 'ui_step', action, label, selector, expected: value, actual: actualValue, passed: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        stepResults.push({
          type: 'ui_step',
          action,
          label,
          selector,
          expected: value,
          actual: actualValue,
          passed: false,
          error: msg,
        });
        return {
          status: 'FAILED',
          durationMs: Date.now() - startedAt,
          assertionResults: stepResults,
          errorMessage: msg,
        };
      }
    }

    return {
      status: 'PASSED',
      durationMs: Date.now() - startedAt,
      request: { method: 'UI', url: startUrl },
      response: { url: page.url(), title: await page.title().catch(() => '') },
      assertionResults: stepResults,
    };
  } catch (e: unknown) {
    return {
      status: 'FAILED',
      durationMs: Date.now() - startedAt,
      errorMessage: e instanceof Error ? e.message : String(e),
      assertionResults: stepResults,
    };
  }
}

export function flattenUiSteps(
  steps: UiStepConfig[],
  sharedMethods: SharedMethodRecord[],
  passedParams: Record<string, string> = {},
  depth = 0
): UiStepConfig[] {
  if (depth > WORKFLOW_LIMITS.sharedMethodMaxDepth) {
    throw new Error('Max depth exceeded - circular dependency in shared methods');
  }
  const flat: UiStepConfig[] = [];
  for (const step of steps) {
    const resolvedStep = { ...step };
    for (const key of ['selector', 'value', 'label'] as const) {
      if (typeof resolvedStep[key] === 'string') {
        let str = resolvedStep[key] as string;
        for (const [pk, pv] of Object.entries(passedParams)) {
          str = str.replace(new RegExp(`\\{\\{\\s*${pk}\\s*\\}\\}`, 'g'), String(pv));
        }
        resolvedStep[key] = str;
      }
    }

    if (resolvedStep.action === 'useMethod') {
      const method = sharedMethods.find((m) => m.id === resolvedStep.methodId);
      if (!method) throw new Error(`Shared method ${resolvedStep.methodId} not found`);
      const methodSteps = parseJson<UiStepConfig[]>(method.uiSteps, []);
      const childParams = { ...passedParams, ...(resolvedStep.params || {}) };
      flat.push(...flattenUiSteps(methodSteps, sharedMethods, childParams, depth + 1));
    } else {
      flat.push(resolvedStep);
    }
  }
  return flat;
}

export async function runUiTestCase(
  testCase: { path: string; uiSteps: string },
  ctx: ExecutionContext,
  resources: RuntimeResources
): Promise<StepResult> {
  const steps = parseJson<UiStepConfig[]>(testCase.uiSteps, []);
  return runUiSteps(steps, testCase.path, ctx, resources);
}
