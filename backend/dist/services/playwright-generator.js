"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightGenerator = void 0;
const parseJson = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    }
    catch {
        return fallback;
    }
};
const literal = (value) => JSON.stringify(value);
class PlaywrightGenerator {
    /**
     * Generates a Playwright TS test file. A spec may contain API tests, UI tests,
     * or a mixed workflow, and each test uses the correct Playwright fixture.
     */
    static generateSpec(runId, project, environment, testCases, sharedMethods = []) {
        const sortedTestCases = [...testCases].sort((a, b) => a.sortOrder - b.sortOrder);
        const baseUrl = environment?.baseUrl || project.baseUrl;
        const projectHeaders = parseJson(project.defaultHeaders, {});
        const envHeaders = environment ? parseJson(environment.headers, {}) : {};
        const mergedDefaultHeaders = { ...projectHeaders, ...envHeaders };
        const projectVariables = parseJson(project.variables, {});
        const envVariables = environment ? parseJson(environment.variables, {}) : {};
        const initialVariables = { ...projectVariables, ...envVariables };
        const testCasesCode = sortedTestCases.map((tc) => {
            const type = tc.testType === 'UI' || tc.method === 'UI' ? 'UI' : 'API';
            return type === 'UI'
                ? this.generateUiTest(runId, tc)
                : this.generateApiTest(runId, tc);
        }).join('\n');
        return `import { test, expect } from '@playwright/test';

const runVariables: Record<string, string> = ${literal(initialVariables)};
const mergedDefaultHeaders: Record<string, string> = ${literal(mergedDefaultHeaders)};
const baseUrl = ${literal(baseUrl)};
const sharedMethods = ${literal(sharedMethods)};

function resolveVariables(template: string, vars: Record<string, string>): string {
  if (typeof template !== 'string') return template;
  return template.replace(/\\{\\{\\s*(\\w+)\\s*\\}\\}/g, (_, name) => {
    return vars[name] !== undefined ? vars[name] : \`{{\${name}}}\`;
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
  if (/^https?:\\/\\//i.test(path)) return path;
  const base = baseUrl.replace(/\\/+$/, '');
  if (!path) return base;
  if (path.startsWith('?') || path.startsWith('#')) return \`\${base}\${path}\`;
  const segment = path.replace(/^\\/+/, '');
  return segment ? \`\${base}/\${segment}\` : base;
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
          str = str.replace(new RegExp(\`\\\\{\\\\{\\\\\\\\s*\${pk}\\\\\\\\s*\\\\}\\\\}\`, 'g'), String(pv));
        }
        resolvedStep[key] = str;
      }
    }

    if (resolvedStep.action === 'useMethod') {
      const method = sharedMethods.find((m: any) => m.id === resolvedStep.methodId);
      if (!method) throw new Error(\`Shared method \${resolvedStep.methodId} not found\`);
      
      const methodSteps = typeof method.uiSteps === 'string' ? JSON.parse(method.uiSteps) : (method.uiSteps || []);
      const childParams = { ...passedParams };
      const stepParams = resolvedStep.params || {};
      for (const [k, v] of Object.entries(stepParams)) {
        let resolvedV = String(v);
        for (const [pk, pv] of Object.entries(passedParams)) {
          resolvedV = resolvedV.replace(new RegExp(\`\\\\{\\\\{\\\\\\\\s*\${pk}\\\\\\\\s*\\\\}\\\\}\`, 'g'), String(pv));
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
  const normalizedPath = path.slice(2).replace(/\\[(\\w+)\\]/g, '.$1');
  const parts = normalizedPath.split('.').map((p) => p.trim()).filter(Boolean);

  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

test.describe('Automation Run ${runId}', () => {
${testCasesCode}
});
`;
    }
    static generateApiTest(runId, tc) {
        const tcHeaders = parseJson(tc.headers, {});
        const tcParams = parseJson(tc.queryParams, {});
        const tcAssertions = parseJson(tc.assertions, []);
        const tcExtractions = parseJson(tc.variablesToExtract, []);
        const bodyContent = tc.body ? literal(tc.body) : 'null';
        return `
  test(${literal(`${runId}:${tc.id}:${tc.name}`)}, async ({ request }, testInfo) => {
    const rawMethod = ${literal(tc.method)};
    const rawPath = ${literal(tc.path)};
    const rawHeaders = ${literal(tcHeaders)};
    const rawParams = ${literal(tcParams)};
    const rawBody = ${bodyContent};

    const headers = {
      ...mergedDefaultHeaders,
      ...resolveHeaders(rawHeaders, runVariables)
    };
    const queryParams = resolveParams(rawParams, runVariables);
    const body = rawBody ? resolveVariables(rawBody, runVariables) : null;
    const url = buildUrl(rawPath);

    const startTime = Date.now();
    let response;
    let responseText = '';
    let responseStatus = 0;
    let responseHeaders: Record<string, string> = {};
    let errorMsg: string | null = null;

    try {
      response = await request.fetch(url, {
        method: rawMethod,
        headers,
        params: queryParams,
        data: body ? (isJson(body) ? JSON.parse(body) : body) : undefined,
        failOnStatusCode: false
      });
      responseText = await response.text();
      responseStatus = response.status();
      responseHeaders = response.headers();
    } catch (e: any) {
      errorMsg = e.message || String(e);
    }
    const durationMs = Date.now() - startTime;

    await testInfo.attach('request_response', {
      contentType: 'application/json',
      body: JSON.stringify({
        request: { method: rawMethod, url, headers, body },
        response: { status: responseStatus, headers: responseHeaders, body: responseText },
        error: errorMsg
      })
    });

    if (errorMsg) {
      throw new Error(\`Network Request Failed: \${errorMsg}\`);
    }

    const assertionDefs = ${literal(tcAssertions)};
    const assertionResults = [];
    let testFailed = false;

    for (const assertion of assertionDefs) {
      let passed = false;
      let actualValue: any = null;
      let resolvedExpected = assertion.expected;

      try {
        resolvedExpected = assertion.expected ? resolveVariables(assertion.expected, runVariables) : assertion.expected;
        if (assertion.type === 'status_code') {
          actualValue = responseStatus;
          passed = responseStatus === Number(resolvedExpected);
        } else if (assertion.type === 'response_time') {
          actualValue = durationMs;
          passed = durationMs <= Number(resolvedExpected);
        } else if (assertion.type === 'json_path') {
          const responseJson = JSON.parse(responseText);
          actualValue = getValueByPath(responseJson, assertion.path);

          if (assertion.operator === 'equals') {
            passed = String(actualValue) === String(resolvedExpected);
          } else if (assertion.operator === 'contains') {
            passed = typeof actualValue === 'string' && actualValue.includes(resolvedExpected);
          } else if (assertion.operator === 'exists') {
            passed = actualValue !== undefined && actualValue !== null;
          } else if (assertion.operator === 'not_exists') {
            passed = actualValue === undefined || actualValue === null;
          }
        } else if (assertion.type === 'header') {
          actualValue = responseHeaders[assertion.headerName.toLowerCase()];
          passed = typeof actualValue === 'string' && actualValue.includes(resolvedExpected);
        }
      } catch (e: any) {
        passed = false;
        actualValue = 'Error checking assertion: ' + e.message;
      }

      assertionResults.push({ ...assertion, resolvedExpected, actual: actualValue, passed });
      if (!passed) testFailed = true;
    }

    await testInfo.attach('assertions', {
      contentType: 'application/json',
      body: JSON.stringify(assertionResults)
    });

    const extractionDefs = ${literal(tcExtractions)};
    if (!testFailed && responseText) {
      try {
        const responseJson = JSON.parse(responseText);
        for (const ext of extractionDefs) {
          const value = getValueByPath(responseJson, ext.path);
          if (value !== undefined) {
            runVariables[ext.variableName] = String(value);
          }
        }
      } catch {
        // Ignore JSON parsing errors for extraction
      }
    }

    if (testFailed) {
      throw new Error('One or more assertions failed.');
    }
  });
`;
    }
    static generateUiTest(runId, tc) {
        const uiSteps = parseJson(tc.uiSteps, []);
        return `
  test(${literal(`${runId}:${tc.id}:${tc.name}`)}, async ({ page }, testInfo) => {
    const steps = ${literal(uiSteps)};
    const rawPath = ${literal(tc.path)};
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
        const label = step.label || \`\${index + 1}. \${action}\`;
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
            await testInfo.attach(value || \`screenshot-\${index + 1}\`, {
              body: await page.screenshot({ fullPage: true }),
              contentType: 'image/png'
            });
          } else {
            throw new Error(\`Unsupported UI action: \${action}\`);
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
`;
    }
}
exports.PlaywrightGenerator = PlaywrightGenerator;
