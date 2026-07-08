"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolExecutionSummary = exports.toolTriggerRun = exports.toolCreateUiTest = exports.toolCreateApiTest = exports.toolFrameworkPreview = exports.toolListTestCases = exports.toolGetProjectContext = exports.toolGetSchema = exports.postExecuteTool = exports.postExplainRun = exports.postAgent = exports.postGenerateTest = exports.getAiStatus = void 0;
const tools_1 = require("../ai/tools");
const ai_service_1 = require("../services/ai.service");
const getAiStatus = (_req, res) => {
    res.json({
        configured: (0, ai_service_1.isAiConfigured)(),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
};
exports.getAiStatus = getAiStatus;
const postGenerateTest = async (req, res) => {
    try {
        const { projectId, prompt, testType } = req.body;
        if (!projectId || !prompt) {
            return res.status(400).json({ error: 'projectId and prompt are required' });
        }
        const generated = await (0, ai_service_1.generateTestFromPrompt)(projectId, prompt, testType);
        res.json({ generated });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status((0, ai_service_1.isAiConfigured)() ? 500 : 503).json({ error: msg });
    }
};
exports.postGenerateTest = postGenerateTest;
const postAgent = async (req, res) => {
    try {
        const { projectId, prompt } = req.body;
        if (!projectId || !prompt) {
            return res.status(400).json({ error: 'projectId and prompt are required' });
        }
        const result = await (0, ai_service_1.runAgent)(projectId, prompt);
        res.json(result);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status((0, ai_service_1.isAiConfigured)() ? 500 : 503).json({ error: msg });
    }
};
exports.postAgent = postAgent;
const postExplainRun = async (req, res) => {
    try {
        const { runId } = req.body;
        if (!runId)
            return res.status(400).json({ error: 'runId is required' });
        const explanation = await (0, ai_service_1.explainFailedRun)(runId);
        res.json({ explanation });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status((0, ai_service_1.isAiConfigured)() ? 500 : 503).json({ error: msg });
    }
};
exports.postExplainRun = postExplainRun;
const postExecuteTool = async (req, res) => {
    try {
        const { name, arguments: args } = req.body;
        if (!name)
            return res.status(400).json({ error: 'name is required' });
        const result = await (0, tools_1.executeTool)(name, args || {});
        res.json({ result });
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.postExecuteTool = postExecuteTool;
// MCP-friendly HTTP tool endpoints
const toolGetSchema = (_req, res) => {
    res.json((0, tools_1.getFrameworkSchema)());
};
exports.toolGetSchema = toolGetSchema;
const toolGetProjectContext = async (req, res) => {
    try {
        res.json(await (0, tools_1.getProjectContext)(req.params.projectId));
    }
    catch (err) {
        res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolGetProjectContext = toolGetProjectContext;
const toolListTestCases = async (req, res) => {
    try {
        res.json(await (0, tools_1.listTestCases)(req.params.projectId));
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolListTestCases = toolListTestCases;
const toolFrameworkPreview = async (req, res) => {
    try {
        res.json(await (0, tools_1.getFrameworkPreview)(req.params.projectId));
    }
    catch (err) {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolFrameworkPreview = toolFrameworkPreview;
const toolCreateApiTest = async (req, res) => {
    try {
        res.status(201).json(await (0, tools_1.createApiTestCase)(req.body));
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolCreateApiTest = toolCreateApiTest;
const toolCreateUiTest = async (req, res) => {
    try {
        res.status(201).json(await (0, tools_1.createUiTestCase)(req.body));
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolCreateUiTest = toolCreateUiTest;
const toolTriggerRun = async (req, res) => {
    try {
        res.status(202).json(await (0, tools_1.triggerTestRun)(req.body));
    }
    catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolTriggerRun = toolTriggerRun;
const toolExecutionSummary = async (req, res) => {
    try {
        res.json(await (0, tools_1.getExecutionSummary)(req.params.runId));
    }
    catch (err) {
        res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
};
exports.toolExecutionSummary = toolExecutionSummary;
