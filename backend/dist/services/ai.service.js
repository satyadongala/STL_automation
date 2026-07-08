"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAiConfigured = isAiConfigured;
exports.runAgent = runAgent;
exports.generateTestFromPrompt = generateTestFromPrompt;
exports.explainFailedRun = explainFailedRun;
const tools_1 = require("../ai/tools");
function loadOpenAI() {
    try {
        // ponytail: lazy load — server must boot even before npm install openai / API key is set
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('openai').default;
    }
    catch {
        throw new Error('OpenAI package missing. Run: npm install --prefix backend');
    }
}
function isAiConfigured() {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
}
function getClient() {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key)
        throw new Error('OPENAI_API_KEY is not configured. Add it to backend/.env or Coolify env vars.');
    const OpenAI = loadOpenAI();
    return new OpenAI({ apiKey: key });
}
function getModel() {
    return process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
}
async function runAgent(projectId, userPrompt) {
    const client = getClient();
    const ctx = await (0, tools_1.getProjectContext)(projectId);
    const steps = [];
    const messages = [
        { role: 'system', content: (0, tools_1.systemPromptForAgent)(projectId) },
        {
            role: 'user',
            content: `Project: ${ctx.name} (${ctx.projectType}), base URL: ${ctx.baseUrl}\n\nTask: ${userPrompt}`,
        },
    ];
    const maxRounds = 12;
    for (let round = 0; round < maxRounds; round++) {
        const response = await client.chat.completions.create({
            model: getModel(),
            messages,
            tools: tools_1.TOOL_DEFINITIONS,
            tool_choice: 'auto',
        });
        const choice = response.choices[0]?.message;
        if (!choice)
            throw new Error('Empty response from OpenAI');
        if (choice.tool_calls?.length) {
            messages.push(choice);
            for (const tc of choice.tool_calls) {
                if (tc.type !== 'function')
                    continue;
                let parsedArgs = {};
                try {
                    parsedArgs = JSON.parse(tc.function.arguments || '{}');
                }
                catch {
                    parsedArgs = {};
                }
                let result;
                try {
                    result = await (0, tools_1.executeTool)(tc.function.name, parsedArgs);
                }
                catch (err) {
                    result = { error: err instanceof Error ? err.message : String(err) };
                }
                steps.push({ type: 'tool', name: tc.function.name, args: parsedArgs, result });
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: JSON.stringify(result),
                });
            }
            continue;
        }
        const reply = choice.content || 'Done.';
        steps.push({ type: 'message', content: reply });
        return { reply, steps };
    }
    return { reply: 'Agent reached max tool rounds. Review steps and try a narrower request.', steps };
}
async function generateTestFromPrompt(projectId, prompt, testType) {
    const client = getClient();
    const ctx = await (0, tools_1.getProjectContext)(projectId);
    const kind = testType || (ctx.projectType === 'UI' ? 'UI' : 'API');
    const system = kind === 'UI'
        ? `Generate a UI test case JSON for STL Automation Platform.
Return JSON only with keys: name, description, path (optional start URL/path), uiSteps (array of {action, selector, value, locatorType}).
Valid actions: click, fill, select, expect_visible, expect_text, expect_url, goto, wait_for_selector, screenshot.
Project base URL: ${ctx.baseUrl}`
        : `Generate an API test case JSON for STL Automation Platform.
Return JSON only with keys: name, description, method, path, headers (object), queryParams (object), body (string or null), assertions (array), variablesToExtract (array).
Assertion types: status_code, json_path (with path, operator, expected), response_time, header (headerName, expected).
JSON paths must have NO spaces. Project base URL: ${ctx.baseUrl}`;
    const response = await client.chat.completions.create({
        model: getModel(),
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
        ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw)
        throw new Error('Empty response from OpenAI');
    return JSON.parse(raw);
}
async function explainFailedRun(runId) {
    const client = getClient();
    const { getExecutionSummary } = await Promise.resolve().then(() => __importStar(require('../ai/tools')));
    const summary = await getExecutionSummary(runId);
    const response = await client.chat.completions.create({
        model: getModel(),
        messages: [
            {
                role: 'system',
                content: 'You explain test failures clearly for QA engineers. Be concise: root cause, fix suggestion, 3-5 bullets max.',
            },
            {
                role: 'user',
                content: `Analyze this test run:\n${JSON.stringify(summary, null, 2)}`,
            },
        ],
    });
    return response.choices[0]?.message?.content || 'Unable to generate explanation.';
}
