import { test, expect } from '@playwright/test';

const runVariables: Record<string, string> = {};
const mergedDefaultHeaders: Record<string, string> = {};
const baseUrl = "https://opensource-demo.orangehrmlive.com/web/index.php/auth/";
const sharedMethods = [];

function resolveVariables(template: string, vars: Record<string, string>): string {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
    return vars[name] !== undefined ? vars[name] : `{{${name}}}`;
  });
}

function resolveHeaders(headers: Record<string, string>, vars: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    resolved[k] = resolveVariables(v, vars);
  }
  return resolved;
}

function resolveParams(params: Record<string, string>, vars: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    resolved[k] = resolveVariables(v, vars);
  }
  return resolved;
}

function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

function buildUrl(rawPath: string): string {
  const path = resolveVariables(rawPath, runVariables);
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl.replace(/\/+$/, '');
  const segment = path.replace(/^\/+/, '');
  return segment ? `${base}/${segment}` : base;
}

function flattenSteps(steps: any[], passedParams: Record<string, string> = {}, depth = 0): any[] {
  if (depth > 20) throw new Error('Max depth exceeded - circular dependency in shared methods');
  let flat: any[] = [];
  for (const step of steps) {
    const resolvedStep = { ...step };
    for (const key of ['selector', 'value', 'url', 'label']) {
      if (typeof resolvedStep[key] === 'string') {
        let str = resolvedStep[key];
        for (const [pk, pv] of Object.entries(passedParams)) {
          str = str.replace(new RegExp(`\\{\\{\\\\s*${pk}\\\\s*\\}\\}`, 'g'), String(pv));
        }
        resolvedStep[key] = str;
      }
    }

    if (resolvedStep.action === 'useMethod') {
      const method = sharedMethods.find((m: any) => m.id === resolvedStep.methodId);
      if (!method) throw new Error(`Shared method ${resolvedStep.methodId} not found`);
      
      const methodSteps = typeof method.uiSteps === 'string' ? JSON.parse(method.uiSteps) : (method.uiSteps || []);
      const childParams = { ...passedParams };
      const stepParams = resolvedStep.params || {};
      for (const [k, v] of Object.entries(stepParams)) {
        let resolvedV = String(v);
        for (const [pk, pv] of Object.entries(passedParams)) {
          resolvedV = resolvedV.replace(new RegExp(`\\{\\{\\\\s*${pk}\\\\s*\\}\\}`, 'g'), String(pv));
        }
        childParams[k] = resolvedV;
      }
      flat.push(...flattenSteps(methodSteps, childParams, depth + 1));
    } else {
      flat.push(resolvedStep);
    }
  }
  return flat;
}

function getValueByPath(obj: any, path: string): any {
  if (path === '$') return obj;
  if (!path.startsWith('$.')) return undefined;
  const normalizedPath = path.slice(2).replace(/\[(\w+)\]/g, '.$1');
  const parts = normalizedPath.split('.');

  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

test.describe('Automation Run 7cdbcaa8-f326-447a-bce9-7b8d3e4e499b', () => {

  test("7cdbcaa8-f326-447a-bce9-7b8d3e4e499b:93e804dd-9bb8-4798-97a0-0f2b0c9cc2c3:Verify the login working or not", async ({ page }, testInfo) => {
    const steps = [{"action":"click","selector":"//input[@name='username']","value":"","variableName":"","locatorType":"xpath"},{"action":"fill","selector":"//input[@name='username']","value":"Admin","variableName":"","locatorType":"xpath"},{"action":"click","selector":"//input[@name='password']","value":"","variableName":"","locatorType":"xpath"},{"action":"fill","selector":"//input[@name='password']","value":"admin123","variableName":"","locatorType":"xpath"},{"action":"click","selector":"//button[@type='submit']","value":"","variableName":"","locatorType":"xpath"}];
    const rawPath = "login";
    const getLocator = (page: any, step: any) => {
      const type = step.locatorType || 'css';
      const sel = step.selector || '';
      switch (type) {
        case 'css':
          return page.locator(sel);
        case 'text':
          return page.getByText(sel);
        case 'role':
          return page.getByRole(sel);
        case 'testId':
          return page.getByTestId(sel);
        case 'placeholder':
          return page.getByPlaceholder(sel);
        case 'label':
          return page.getByLabel(sel);
        case 'xpath':
          return page.locator('xpath=' + sel);
        default:
          return page.locator(sel);
      }
    };
    const startUrl = buildUrl(rawPath);
    const stepResults = [];
    let testFailed = false;
    let errorMsg: string | null = null;

    const startedAt = Date.now();
    let flatSteps: any[] = [];
    try {
      await page.goto(startUrl);
      flatSteps = flattenSteps(steps);

      for (const [index, step] of flatSteps.entries()) {
        const action = step.action;
        const selector = step.selector ? resolveVariables(step.selector, runVariables) : '';
        const value = step.value ? resolveVariables(step.value, runVariables) : '';
        const variableName = step.variableName || '';
        const label = step.label || `${index + 1}. ${action}`;
        let actualValue: any = null;

        try {
          const locator = getLocator(page, step);
          if (action === 'goto') {
            await page.goto(buildUrl(value || rawPath));
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
            if (variableName) runVariables[variableName] = String(actualValue);
          } else if (action === 'screenshot') {
            await testInfo.attach(value || `screenshot-${index + 1}`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: 'image/png'
            });
          } else {
            throw new Error(`Unsupported UI action: ${action}`);
          }

          stepResults.push({ type: 'ui_step', action, label, selector, expected: value, actual: actualValue, passed: true });
        } catch (e: any) {
          testFailed = true;
          stepResults.push({
            type: 'ui_step',
            action,
            label,
            selector,
            expected: value,
            actual: actualValue,
            passed: false,
            error: e.message || String(e)
          });
          break;
        }
      }
    } catch (e: any) {
      testFailed = true;
      errorMsg = e.message || String(e);
    }

    await testInfo.attach('request_response', {
      contentType: 'application/json',
      body: JSON.stringify({
        request: { method: 'UI', url: startUrl, headers: {}, body: JSON.stringify(flatSteps) },
        response: { status: 0, headers: {}, body: JSON.stringify({ url: page.url(), title: await page.title().catch(() => '') }) },
        error: errorMsg
      })
    });

    await testInfo.attach('assertions', {
      contentType: 'application/json',
      body: JSON.stringify(stepResults)
    });

    if (testFailed) {
      throw new Error(errorMsg || 'One or more UI steps failed.');
    }
  });


  test("7cdbcaa8-f326-447a-bce9-7b8d3e4e499b:6c60dbd0-8e34-4ab1-93ae-e3830be5aa93:click on PIM", async ({ page }, testInfo) => {
    const steps = [{"action":"click","selector":"//input[@name='username']","value":"","variableName":"","locatorType":"xpath"},{"action":"fill","selector":"//input[@name='username']","value":"Admin","variableName":"","locatorType":"xpath"},{"action":"click","selector":"//input[@name='password']","value":"","variableName":"","locatorType":"xpath"},{"action":"fill","selector":"//input[@name='password']","value":"admin123","variableName":"","locatorType":"xpath"},{"action":"click","selector":"//button[@type='submit']","value":"","variableName":"","locatorType":"xpath"},{"action":"click","selector":"//*[@id=\"app\"]/div[1]/div[1]/aside/nav/div[2]/ul/li[2]/a","value":"","variableName":"","locatorType":"xpath"}];
    const rawPath = "login";
    const getLocator = (page: any, step: any) => {
      const type = step.locatorType || 'css';
      const sel = step.selector || '';
      switch (type) {
        case 'css':
          return page.locator(sel);
        case 'text':
          return page.getByText(sel);
        case 'role':
          return page.getByRole(sel);
        case 'testId':
          return page.getByTestId(sel);
        case 'placeholder':
          return page.getByPlaceholder(sel);
        case 'label':
          return page.getByLabel(sel);
        case 'xpath':
          return page.locator('xpath=' + sel);
        default:
          return page.locator(sel);
      }
    };
    const startUrl = buildUrl(rawPath);
    const stepResults = [];
    let testFailed = false;
    let errorMsg: string | null = null;

    const startedAt = Date.now();
    let flatSteps: any[] = [];
    try {
      await page.goto(startUrl);
      flatSteps = flattenSteps(steps);

      for (const [index, step] of flatSteps.entries()) {
        const action = step.action;
        const selector = step.selector ? resolveVariables(step.selector, runVariables) : '';
        const value = step.value ? resolveVariables(step.value, runVariables) : '';
        const variableName = step.variableName || '';
        const label = step.label || `${index + 1}. ${action}`;
        let actualValue: any = null;

        try {
          const locator = getLocator(page, step);
          if (action === 'goto') {
            await page.goto(buildUrl(value || rawPath));
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
            if (variableName) runVariables[variableName] = String(actualValue);
          } else if (action === 'screenshot') {
            await testInfo.attach(value || `screenshot-${index + 1}`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: 'image/png'
            });
          } else {
            throw new Error(`Unsupported UI action: ${action}`);
          }

          stepResults.push({ type: 'ui_step', action, label, selector, expected: value, actual: actualValue, passed: true });
        } catch (e: any) {
          testFailed = true;
          stepResults.push({
            type: 'ui_step',
            action,
            label,
            selector,
            expected: value,
            actual: actualValue,
            passed: false,
            error: e.message || String(e)
          });
          break;
        }
      }
    } catch (e: any) {
      testFailed = true;
      errorMsg = e.message || String(e);
    }

    await testInfo.attach('request_response', {
      contentType: 'application/json',
      body: JSON.stringify({
        request: { method: 'UI', url: startUrl, headers: {}, body: JSON.stringify(flatSteps) },
        response: { status: 0, headers: {}, body: JSON.stringify({ url: page.url(), title: await page.title().catch(() => '') }) },
        error: errorMsg
      })
    });

    await testInfo.attach('assertions', {
      contentType: 'application/json',
      body: JSON.stringify(stepResults)
    });

    if (testFailed) {
      throw new Error(errorMsg || 'One or more UI steps failed.');
    }
  });

});
