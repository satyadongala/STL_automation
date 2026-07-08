"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_DEFINITIONS = void 0;
exports.getFrameworkSchema = getFrameworkSchema;
exports.getProjectContext = getProjectContext;
exports.listTestCases = listTestCases;
exports.getFrameworkPreview = getFrameworkPreview;
exports.createApiTestCase = createApiTestCase;
exports.createUiTestCase = createUiTestCase;
exports.triggerTestRun = triggerTestRun;
exports.getExecutionSummary = getExecutionSummary;
exports.executeTool = executeTool;
exports.systemPromptForAgent = systemPromptForAgent;
const db_1 = __importDefault(require("../db"));
const generator_service_1 = require("../services/generator.service");
const execution_router_1 = require("../services/execution-router");
const framework_schema_1 = require("./framework-schema");
const parseJson = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    }
    catch {
        return fallback;
    }
};
function getFrameworkSchema() {
    return framework_schema_1.FRAMEWORK_SCHEMA;
}
async function getProjectContext(projectId) {
    const project = await db_1.default.project.findUnique({
        where: { id: projectId },
        include: {
            environments: true,
            testCases: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, testType: true, method: true, path: true } },
            sharedMethods: { select: { id: true, name: true, description: true } },
        },
    });
    if (!project)
        throw new Error('Project not found');
    return {
        id: project.id,
        name: project.name,
        projectType: project.projectType,
        baseUrl: project.baseUrl,
        description: project.description,
        variables: parseJson(project.variables, {}),
        defaultHeaders: parseJson(project.defaultHeaders, {}),
        environments: project.environments.map((e) => ({ id: e.id, name: e.name, baseUrl: e.baseUrl })),
        testCases: project.testCases,
        sharedMethods: project.sharedMethods,
        frameworkLayout: framework_schema_1.FRAMEWORK_SCHEMA,
    };
}
async function listTestCases(projectId) {
    const cases = await db_1.default.testCase.findMany({
        where: { projectId },
        orderBy: { sortOrder: 'asc' },
    });
    return cases.map((tc) => ({
        id: tc.id,
        name: tc.name,
        testType: tc.testType,
        method: tc.method,
        path: tc.path,
        description: tc.description,
        headers: parseJson(tc.headers, {}),
        queryParams: parseJson(tc.queryParams, {}),
        body: tc.body,
        assertions: parseJson(tc.assertions, []),
        variablesToExtract: parseJson(tc.variablesToExtract, []),
        uiSteps: parseJson(tc.uiSteps, []),
    }));
}
async function getFrameworkPreview(projectId) {
    const files = await generator_service_1.GeneratorService.generatePreview(projectId);
    return {
        fileCount: files.length,
        paths: files.map((f) => f.path),
        files: files.slice(0, 30),
    };
}
async function createApiTestCase(input) {
    const maxOrder = await db_1.default.testCase.aggregate({
        where: { projectId: input.projectId },
        _max: { sortOrder: true },
    });
    const tc = await db_1.default.testCase.create({
        data: {
            projectId: input.projectId,
            testType: 'API',
            name: input.name,
            description: input.description,
            method: input.method.toUpperCase(),
            path: input.path,
            headers: JSON.stringify(input.headers || {}),
            queryParams: JSON.stringify(input.queryParams || {}),
            body: input.body || null,
            assertions: JSON.stringify(input.assertions || []),
            variablesToExtract: JSON.stringify(input.variablesToExtract || []),
            uiSteps: '[]',
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
    });
    return { id: tc.id, name: tc.name, message: 'API test case created' };
}
async function createUiTestCase(input) {
    const maxOrder = await db_1.default.testCase.aggregate({
        where: { projectId: input.projectId },
        _max: { sortOrder: true },
    });
    const tc = await db_1.default.testCase.create({
        data: {
            projectId: input.projectId,
            testType: 'UI',
            name: input.name,
            description: input.description,
            method: 'UI',
            path: input.path || '',
            headers: '{}',
            queryParams: '{}',
            body: null,
            assertions: JSON.stringify(input.assertions || []),
            variablesToExtract: '[]',
            uiSteps: JSON.stringify(input.uiSteps || []),
            sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
    });
    return { id: tc.id, name: tc.name, message: 'UI test case created' };
}
async function triggerTestRun(input) {
    const run = await db_1.default.executionRun.create({
        data: {
            projectId: input.projectId,
            environmentId: input.environmentId || null,
            status: 'PENDING',
            triggerType: 'AI_AGENT',
        },
    });
    (0, execution_router_1.startExecution)({
        runId: run.id,
        projectId: input.projectId,
        environmentId: input.environmentId || null,
        testCaseIds: input.testCaseIds,
    });
    return { runId: run.id, status: run.status, message: 'Execution started' };
}
async function getExecutionSummary(runId) {
    const run = await db_1.default.executionRun.findUnique({
        where: { id: runId },
        include: {
            project: { select: { name: true } },
            results: { include: { testCase: { select: { name: true, method: true } } } },
        },
    });
    if (!run)
        throw new Error('Run not found');
    return {
        id: run.id,
        status: run.status,
        project: run.project?.name,
        summaryPassed: run.summaryPassed,
        summaryFailed: run.summaryFailed,
        summaryTotal: run.summaryTotal,
        durationMs: run.durationMs,
        rawLogs: run.rawLogs?.slice(-8000),
        results: run.results?.map((r) => ({
            testCase: r.testCase?.name,
            status: r.status,
            errorMessage: r.errorMessage,
        })),
    };
}
exports.TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'get_framework_schema',
            description: 'Get the Playwright POM framework folder layout and assertion rules used by this platform',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_project_context',
            description: 'Get project metadata, base URL, environments, existing test names, shared methods',
            parameters: {
                type: 'object',
                properties: { projectId: { type: 'string' } },
                required: ['projectId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_test_cases',
            description: 'List all test cases with full JSON (assertions, uiSteps, etc.)',
            parameters: {
                type: 'object',
                properties: { projectId: { type: 'string' } },
                required: ['projectId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_framework_preview',
            description: 'Preview exported Playwright framework files for this project',
            parameters: {
                type: 'object',
                properties: { projectId: { type: 'string' } },
                required: ['projectId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_api_test_case',
            description: 'Create an API test case in the platform database',
            parameters: {
                type: 'object',
                properties: {
                    projectId: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    method: { type: 'string' },
                    path: { type: 'string' },
                    headers: { type: 'object' },
                    queryParams: { type: 'object' },
                    body: { type: 'string' },
                    assertions: { type: 'array' },
                    variablesToExtract: { type: 'array' },
                },
                required: ['projectId', 'name', 'method', 'path'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_ui_test_case',
            description: 'Create a UI/browser test case with uiSteps array',
            parameters: {
                type: 'object',
                properties: {
                    projectId: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    path: { type: 'string' },
                    uiSteps: { type: 'array' },
                    assertions: { type: 'array' },
                },
                required: ['projectId', 'name', 'uiSteps'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'trigger_test_run',
            description: 'Run test cases and return runId for monitoring',
            parameters: {
                type: 'object',
                properties: {
                    projectId: { type: 'string' },
                    testCaseIds: { type: 'array', items: { type: 'string' } },
                    environmentId: { type: 'string' },
                },
                required: ['projectId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_execution_summary',
            description: 'Get execution status, pass/fail counts, logs snippet, per-test errors',
            parameters: {
                type: 'object',
                properties: { runId: { type: 'string' } },
                required: ['runId'],
                additionalProperties: false,
            },
        },
    },
];
async function executeTool(name, args) {
    switch (name) {
        case 'get_framework_schema':
            return getFrameworkSchema();
        case 'get_project_context':
            return getProjectContext(String(args.projectId));
        case 'list_test_cases':
            return listTestCases(String(args.projectId));
        case 'get_framework_preview':
            return getFrameworkPreview(String(args.projectId));
        case 'create_api_test_case':
            return createApiTestCase(args);
        case 'create_ui_test_case':
            return createUiTestCase(args);
        case 'trigger_test_run':
            return triggerTestRun(args);
        case 'get_execution_summary':
            return getExecutionSummary(String(args.runId));
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
function systemPromptForAgent(projectId) {
    return `You are an expert test automation engineer for the STL Automation Platform (Satya Tech Lab).
You create API and UI tests that match the platform's data model and exported Playwright POM framework.

Framework layout:
${(0, framework_schema_1.frameworkSchemaText)()}

Rules:
- JSON path assertions: no spaces in paths (use $.data[0].name).
- API assertion types: status_code, json_path, response_time, header.
- UI steps use: action, selector, value, variableName, locatorType (css).
- Prefer reusing existing test patterns in the project before inventing new ones.
- After creating tests, you may trigger_test_run with specific testCaseIds.
- Current projectId: ${projectId}

Respond concisely. Use tools to read context before creating tests.`;
}
