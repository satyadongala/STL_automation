"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderTestCases = exports.deleteTestCase = exports.updateTestCase = exports.createTestCase = exports.getTestCaseById = exports.getTestCases = void 0;
const db_1 = __importDefault(require("../db"));
const getTestCases = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId)
            return res.status(400).json({ error: 'projectId is required' });
        const testCases = await db_1.default.testCase.findMany({
            where: { projectId: String(projectId) },
            orderBy: { sortOrder: 'asc' }
        });
        res.json(testCases);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getTestCases = getTestCases;
const getTestCaseById = async (req, res) => {
    try {
        const { id } = req.params;
        const testCase = await db_1.default.testCase.findUnique({ where: { id } });
        if (!testCase)
            return res.status(404).json({ error: 'Test case not found' });
        res.json(testCase);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getTestCaseById = getTestCaseById;
const createTestCase = async (req, res) => {
    try {
        const { projectId, testType, name, description, method, path, headers, queryParams, body, assertions, variablesToExtract, uiSteps, sortOrder } = req.body;
        const normalizedTestType = testType === 'UI' ? 'UI' : 'API';
        if (!projectId || !name || !path) {
            return res.status(400).json({ error: 'projectId, name, and path are required' });
        }
        if (normalizedTestType === 'API' && !method) {
            return res.status(400).json({ error: 'method is required for API test cases' });
        }
        const testCase = await db_1.default.testCase.create({
            data: {
                projectId,
                testType: normalizedTestType,
                name,
                description,
                method: normalizedTestType === 'UI' ? 'UI' : method,
                path,
                headers: headers ? JSON.stringify(headers) : '{}',
                queryParams: queryParams ? JSON.stringify(queryParams) : '{}',
                body: body || null,
                assertions: assertions ? JSON.stringify(assertions) : '[]',
                variablesToExtract: variablesToExtract ? JSON.stringify(variablesToExtract) : '[]',
                uiSteps: uiSteps ? JSON.stringify(uiSteps) : '[]',
                sortOrder: sortOrder !== undefined ? Number(sortOrder) : 0
            }
        });
        res.status(201).json(testCase);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.createTestCase = createTestCase;
const updateTestCase = async (req, res) => {
    try {
        const { id } = req.params;
        const { testType, name, description, method, path, headers, queryParams, body, assertions, variablesToExtract, uiSteps, sortOrder } = req.body;
        const normalizedTestType = testType === 'UI' ? 'UI' : testType === 'API' ? 'API' : undefined;
        const testCase = await db_1.default.testCase.update({
            where: { id },
            data: {
                testType: normalizedTestType,
                name,
                description,
                method: normalizedTestType === 'UI' ? 'UI' : method,
                path,
                headers: headers ? JSON.stringify(headers) : undefined,
                queryParams: queryParams ? JSON.stringify(queryParams) : undefined,
                body: body !== undefined ? body : undefined,
                assertions: assertions ? JSON.stringify(assertions) : undefined,
                variablesToExtract: variablesToExtract ? JSON.stringify(variablesToExtract) : undefined,
                uiSteps: uiSteps ? JSON.stringify(uiSteps) : undefined,
                sortOrder: sortOrder !== undefined ? Number(sortOrder) : undefined
            }
        });
        res.json(testCase);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.updateTestCase = updateTestCase;
const deleteTestCase = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.testCase.delete({ where: { id } });
        res.json({ message: 'Test case deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.deleteTestCase = deleteTestCase;
const reorderTestCases = async (req, res) => {
    try {
        const { orders } = req.body; // Array of { id: string, sortOrder: number }
        if (!orders || !Array.isArray(orders)) {
            return res.status(400).json({ error: 'orders array is required' });
        }
        await db_1.default.$transaction(orders.map((item) => db_1.default.testCase.update({
            where: { id: item.id },
            data: { sortOrder: Number(item.sortOrder) }
        })));
        res.json({ message: 'Test cases reordered successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.reorderTestCases = reorderTestCases;
