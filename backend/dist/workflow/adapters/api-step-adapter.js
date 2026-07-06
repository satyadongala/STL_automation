"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runApiStep = runApiStep;
exports.runApiTestCase = runApiTestCase;
const step_utils_1 = require("../step-utils");
async function runApiStep(config, ctx, resources, assertions = [], extractions = []) {
    const vars = ctx.getSnapshot();
    const startTime = Date.now();
    const headers = {
        ...resources.mergedDefaultHeaders,
        ...(0, step_utils_1.resolveHeaders)(config.headers || {}, vars),
    };
    const queryParams = (0, step_utils_1.resolveParams)(config.queryParams || {}, vars);
    const body = config.body ? (0, step_utils_1.resolveVariables)(config.body, vars) : null;
    const url = (0, step_utils_1.buildUrl)(resources.baseUrl, config.path, vars);
    let responseText = '';
    let responseStatus = 0;
    let responseHeaders = {};
    let errorMsg = null;
    try {
        const response = await resources.apiRequest.fetch(url, {
            method: config.method,
            headers,
            params: queryParams,
            data: body ? ((0, step_utils_1.isJson)(body) ? JSON.parse(body) : body) : undefined,
            failOnStatusCode: false,
        });
        responseText = await response.text();
        responseStatus = response.status();
        responseHeaders = response.headers();
    }
    catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e);
    }
    const durationMs = Date.now() - startTime;
    let bodyJson;
    try {
        bodyJson = responseText ? JSON.parse(responseText) : null;
    }
    catch {
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
    const assertionResults = [];
    let testFailed = false;
    for (const assertion of assertions) {
        let passed = false;
        let actualValue = null;
        let resolvedExpected = assertion.expected;
        try {
            resolvedExpected = assertion.expected
                ? (0, step_utils_1.resolveVariables)(assertion.expected, vars)
                : assertion.expected;
            if (assertion.type === 'status_code') {
                actualValue = responseStatus;
                passed = responseStatus === Number(resolvedExpected);
            }
            else if (assertion.type === 'response_time') {
                actualValue = durationMs;
                passed = durationMs <= Number(resolvedExpected);
            }
            else if (assertion.type === 'json_path' && bodyJson !== undefined) {
                actualValue = (0, step_utils_1.getValueByPath)(bodyJson, assertion.path || '$');
                if (assertion.operator === 'equals') {
                    passed = String(actualValue) === String(resolvedExpected);
                }
                else if (assertion.operator === 'contains') {
                    passed = typeof actualValue === 'string' && actualValue.includes(String(resolvedExpected));
                }
                else if (assertion.operator === 'exists') {
                    passed = actualValue !== undefined && actualValue !== null;
                }
                else if (assertion.operator === 'not_exists') {
                    passed = actualValue === undefined || actualValue === null;
                }
            }
            else if (assertion.type === 'header' && assertion.headerName) {
                actualValue = responseHeaders[assertion.headerName.toLowerCase()];
                passed = typeof actualValue === 'string' && actualValue.includes(String(resolvedExpected));
            }
        }
        catch (e) {
            passed = false;
            actualValue = `Error: ${e instanceof Error ? e.message : String(e)}`;
        }
        assertionResults.push({ ...assertion, resolvedExpected, actual: actualValue, passed });
        if (!passed)
            testFailed = true;
    }
    if (!testFailed && responseText && extractions.length > 0 && bodyJson !== undefined) {
        for (const ext of extractions) {
            const value = (0, step_utils_1.getValueByPath)(bodyJson, ext.path);
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
async function runApiTestCase(testCase, ctx, resources) {
    return runApiStep({
        method: testCase.method,
        path: testCase.path,
        headers: (0, step_utils_1.parseJson)(testCase.headers, {}),
        queryParams: (0, step_utils_1.parseJson)(testCase.queryParams, {}),
        body: testCase.body,
    }, ctx, resources, (0, step_utils_1.parseJson)(testCase.assertions, []), (0, step_utils_1.parseJson)(testCase.variablesToExtract, []));
}
