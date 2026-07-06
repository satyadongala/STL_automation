"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTestCaseRef = runTestCaseRef;
const db_1 = __importDefault(require("../../db"));
const step_utils_1 = require("../step-utils");
const api_step_adapter_1 = require("./api-step-adapter");
const ui_step_adapter_1 = require("./ui-step-adapter");
async function runTestCaseRef(testCaseId, ctx, resources, parameterOverrides = {}) {
    const testCase = await db_1.default.testCase.findUnique({ where: { id: testCaseId } });
    if (!testCase) {
        return { status: 'FAILED', durationMs: 0, errorMessage: `Test case ${testCaseId} not found` };
    }
    const resolvedOverrides = {};
    for (const [k, v] of Object.entries(parameterOverrides)) {
        resolvedOverrides[k] = (0, step_utils_1.resolveVariables)(v, ctx.getSnapshot());
    }
    ctx.applyOverrides(resolvedOverrides);
    const isUi = testCase.testType === 'UI' || testCase.method === 'UI';
    if (isUi) {
        return (0, ui_step_adapter_1.runUiTestCase)(testCase, ctx, resources);
    }
    return (0, api_step_adapter_1.runApiTestCase)(testCase, ctx, resources);
}
