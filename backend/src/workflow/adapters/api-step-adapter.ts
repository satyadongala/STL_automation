import type { ApiStepConfig, AssertionDef, ExtractionDef, RuntimeResources, StepResult } from '../types';
import { ExecutionContext } from '../execution-context';
import {
  buildUrl,
  getValueByPath,
  isJson,
  parseJson,
  resolveHeaders,
  resolveParams,
  resolveVariables,
} from '../step-utils';

export async function runApiStep(
  config: ApiStepConfig,
  ctx: ExecutionContext,
  resources: RuntimeResources,
  assertions: AssertionDef[] = [],
  extractions: ExtractionDef[] = []
): Promise<StepResult> {
  const vars = ctx.getSnapshot();
  const startTime = Date.now();
  const headers = {
    ...resources.mergedDefaultHeaders,
    ...resolveHeaders(config.headers || {}, vars),
  };
  const queryParams = resolveParams(config.queryParams || {}, vars);
  const body = config.body ? resolveVariables(config.body, vars) : null;
  const url = buildUrl(resources.baseUrl, config.path, vars);

  let responseText = '';
  let responseStatus = 0;
  let responseHeaders: Record<string, string> = {};
  let errorMsg: string | null = null;

  try {
    const response = await resources.apiRequest.fetch(url, {
      method: config.method,
      headers,
      params: queryParams,
      data: body ? (isJson(body) ? JSON.parse(body) : body) : undefined,
      failOnStatusCode: false,
    });
    responseText = await response.text();
    responseStatus = response.status();
    responseHeaders = response.headers();
  } catch (e: unknown) {
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  const durationMs = Date.now() - startTime;
  let bodyJson: unknown;
  try {
    bodyJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    bodyJson = undefined;
  }

  ctx.lastApiResponse = {
    status: responseStatus,
    headers: responseHeaders,
    bodyText: responseText,
    bodyJson,
  };

  if (errorMsg) {
    return {
      status: 'FAILED',
      durationMs,
      request: { method: config.method, url, headers, body },
      response: { status: responseStatus, headers: responseHeaders, body: responseText },
      errorMessage: `Network Request Failed: ${errorMsg}`,
    };
  }

  const assertionResults: unknown[] = [];
  let testFailed = false;

  for (const assertion of assertions) {
    let passed = false;
    let actualValue: unknown = null;
    let resolvedExpected = assertion.expected;

    try {
      resolvedExpected = assertion.expected
        ? resolveVariables(assertion.expected, vars)
        : assertion.expected;

      if (assertion.type === 'status_code') {
        actualValue = responseStatus;
        passed = responseStatus === Number(resolvedExpected);
      } else if (assertion.type === 'response_time') {
        actualValue = durationMs;
        passed = durationMs <= Number(resolvedExpected);
      } else if (assertion.type === 'json_path' && bodyJson !== undefined) {
        actualValue = getValueByPath(bodyJson, assertion.path || '$');
        if (assertion.operator === 'equals') {
          passed = String(actualValue) === String(resolvedExpected);
        } else if (assertion.operator === 'contains') {
          passed = typeof actualValue === 'string' && actualValue.includes(String(resolvedExpected));
        } else if (assertion.operator === 'exists') {
          passed = actualValue !== undefined && actualValue !== null;
        } else if (assertion.operator === 'not_exists') {
          passed = actualValue === undefined || actualValue === null;
        }
      } else if (assertion.type === 'header' && assertion.headerName) {
        actualValue = responseHeaders[assertion.headerName.toLowerCase()];
        passed = typeof actualValue === 'string' && actualValue.includes(String(resolvedExpected));
      }
    } catch (e: unknown) {
      passed = false;
      actualValue = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }

    assertionResults.push({ ...assertion, resolvedExpected, actual: actualValue, passed });
    if (!passed) testFailed = true;
  }

  if (!testFailed && responseText && extractions.length > 0 && bodyJson !== undefined) {
    for (const ext of extractions) {
      const value = getValueByPath(bodyJson, ext.path);
      if (value !== undefined) {
        ctx.set(ext.variableName, String(value), 'workflow');
      }
    }
  }

  if (testFailed) {
    return {
      status: 'FAILED',
      durationMs,
      request: { method: config.method, url, headers, body },
      response: { status: responseStatus, headers: responseHeaders, body: responseText },
      assertionResults,
      errorMessage: 'One or more assertions failed.',
    };
  }

  return {
    status: 'PASSED',
    durationMs,
    request: { method: config.method, url, headers, body },
    response: { status: responseStatus, headers: responseHeaders, body: responseText },
    assertionResults,
  };
}

export async function runApiTestCase(
  testCase: {
    method: string;
    path: string;
    headers: string;
    queryParams: string;
    body?: string | null;
    assertions: string;
    variablesToExtract: string;
  },
  ctx: ExecutionContext,
  resources: RuntimeResources
): Promise<StepResult> {
  return runApiStep(
    {
      method: testCase.method,
      path: testCase.path,
      headers: parseJson(testCase.headers, {}),
      queryParams: parseJson(testCase.queryParams, {}),
      body: testCase.body,
    },
    ctx,
    resources,
    parseJson(testCase.assertions, []),
    parseJson(testCase.variablesToExtract, [])
  );
}
