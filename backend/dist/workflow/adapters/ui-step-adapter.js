"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUiSteps = runUiSteps;
exports.flattenUiSteps = flattenUiSteps;
exports.runUiTestCase = runUiTestCase;
const test_1 = require("@playwright/test");
const limits_1 = require("../limits");
const step_utils_1 = require("../step-utils");
async function runUiSteps(steps, startPath, ctx, resources) {
    const page = resources.page;
    if (!page) {
        return { status: 'FAILED', durationMs: 0, errorMessage: 'Browser page is not available for UI steps' };
    }
    const vars = ctx.getSnapshot();
    const startUrl = (0, step_utils_1.buildUrl)(resources.baseUrl, startPath, vars);
    const stepResults = [];
    const startedAt = Date.now();
    try {
        await page.goto(startUrl);
        const flatSteps = flattenUiSteps(steps, resources.sharedMethods);
        for (const [index, step] of flatSteps.entries()) {
            const action = step.action;
            const selector = step.selector ? (0, step_utils_1.resolveVariables)(step.selector, ctx.getSnapshot()) : '';
            const value = step.value ? (0, step_utils_1.resolveVariables)(step.value, ctx.getSnapshot()) : '';
            const variableName = step.variableName || '';
            const label = step.label || `${index + 1}. ${action}`;
            let actualValue = null;
            try {
                const locator = (0, step_utils_1.getLocator)(page, step);
                if (action === 'goto') {
                    await page.goto((0, step_utils_1.buildUrl)(resources.baseUrl, value || startPath, ctx.getSnapshot()));
                    actualValue = page.url();
                }
                else if (action === 'click') {
                    await locator.click();
                }
                else if (action === 'fill') {
                    await locator.fill(value);
                }
                else if (action === 'select') {
                    await locator.selectOption(value);
                }
                else if (action === 'check') {
                    await locator.check();
                }
                else if (action === 'uncheck') {
                    await locator.uncheck();
                }
                else if (action === 'wait_for_selector') {
                    await locator.waitFor({ state: 'visible' });
                }
                else if (action === 'expect_visible') {
                    await (0, test_1.expect)(locator).toBeVisible();
                }
                else if (action === 'expect_text') {
                    await (0, test_1.expect)(locator).toContainText(value);
                    actualValue = await locator.innerText().catch(() => null);
                }
                else if (action === 'expect_url') {
                    await (0, test_1.expect)(page).toHaveURL(new RegExp(value));
                    actualValue = page.url();
                }
                else if (action === 'extract_text') {
                    actualValue = await locator.innerText();
                    if (variableName)
                        ctx.set(variableName, String(actualValue), 'workflow');
                }
                else if (action === 'screenshot') {
                    // no-op in interpreter mode without testInfo
                }
                else {
                    throw new Error(`Unsupported UI action: ${action}`);
                }
                stepResults.push({ type: 'ui_step', action, label, selector, expected: value, actual: actualValue, passed: true });
            }
            catch (e) {
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
    }
    catch (e) {
        return {
            status: 'FAILED',
            durationMs: Date.now() - startedAt,
            errorMessage: e instanceof Error ? e.message : String(e),
            assertionResults: stepResults,
        };
    }
}
function flattenUiSteps(steps, sharedMethods, passedParams = {}, depth = 0) {
    if (depth > limits_1.WORKFLOW_LIMITS.sharedMethodMaxDepth) {
        throw new Error('Max depth exceeded - circular dependency in shared methods');
    }
    const flat = [];
    for (const step of steps) {
        const resolvedStep = { ...step };
        for (const key of ['selector', 'value', 'label']) {
            if (typeof resolvedStep[key] === 'string') {
                let str = resolvedStep[key];
                for (const [pk, pv] of Object.entries(passedParams)) {
                    str = str.replace(new RegExp(`\\{\\{\\s*${pk}\\s*\\}\\}`, 'g'), String(pv));
                }
                resolvedStep[key] = str;
            }
        }
        if (resolvedStep.action === 'useMethod') {
            const method = sharedMethods.find((m) => m.id === resolvedStep.methodId);
            if (!method)
                throw new Error(`Shared method ${resolvedStep.methodId} not found`);
            const methodSteps = (0, step_utils_1.parseJson)(method.uiSteps, []);
            const childParams = { ...passedParams, ...(resolvedStep.params || {}) };
            flat.push(...flattenUiSteps(methodSteps, sharedMethods, childParams, depth + 1));
        }
        else {
            flat.push(resolvedStep);
        }
    }
    return flat;
}
async function runUiTestCase(testCase, ctx, resources) {
    const steps = (0, step_utils_1.parseJson)(testCase.uiSteps, []);
    return runUiSteps(steps, testCase.path, ctx, resources);
}
