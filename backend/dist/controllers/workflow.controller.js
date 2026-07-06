"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowController = void 0;
const db_1 = __importDefault(require("../db"));
const execution_router_1 = require("../services/execution-router");
const definition_validator_1 = require("../workflow/definition-validator");
const linear_to_definition_1 = require("../workflow/linear-to-definition");
const ws_1 = require("../ws");
class WorkflowController {
    static async getWorkflows(req, res) {
        try {
            const { projectId } = req.params;
            const workflows = await db_1.default.workflow.findMany({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
                include: {
                    testCases: {
                        include: {
                            testCase: true
                        },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });
            res.json(workflows);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async getWorkflow(req, res) {
        try {
            const { id } = req.params;
            const workflow = await db_1.default.workflow.findUnique({
                where: { id },
                include: {
                    testCases: {
                        include: {
                            testCase: true
                        },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });
            if (!workflow)
                return res.status(404).json({ error: 'Workflow not found' });
            res.json(workflow);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async createWorkflow(req, res) {
        try {
            const { projectId } = req.params;
            const { name, description, definition } = req.body;
            if (definition) {
                const defString = typeof definition === 'string' ? definition : JSON.stringify(definition);
                if (defString !== '{}')
                    (0, definition_validator_1.parseWorkflowDefinition)(defString);
            }
            const workflow = await db_1.default.workflow.create({
                data: {
                    projectId,
                    name,
                    description,
                    definition: definition ? JSON.stringify(definition) : '{}',
                }
            });
            res.status(201).json(workflow);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async updateWorkflow(req, res) {
        try {
            const { id } = req.params;
            const { name, description, definition, version } = req.body;
            const data = {};
            if (name !== undefined)
                data.name = name;
            if (description !== undefined)
                data.description = description;
            if (version !== undefined)
                data.version = version;
            if (definition !== undefined) {
                const defString = typeof definition === 'string' ? definition : JSON.stringify(definition);
                if (defString && defString !== '{}')
                    (0, definition_validator_1.parseWorkflowDefinition)(defString);
                data.definition = defString;
            }
            const workflow = await db_1.default.workflow.update({
                where: { id },
                data,
            });
            res.json(workflow);
        }
        catch (error) {
            if (error instanceof definition_validator_1.DefinitionValidationError) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }
    static async updateWorkflowDefinition(req, res) {
        try {
            const { id } = req.params;
            const { definition } = req.body;
            const defString = typeof definition === 'string' ? definition : JSON.stringify(definition);
            (0, definition_validator_1.parseWorkflowDefinition)(defString);
            const workflow = await db_1.default.workflow.update({
                where: { id },
                data: { definition: defString, version: { increment: 1 } },
            });
            res.json(workflow);
        }
        catch (error) {
            if (error instanceof definition_validator_1.DefinitionValidationError) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: error.message });
        }
    }
    static async convertLinearToDefinition(req, res) {
        try {
            const { id } = req.params;
            const workflow = await db_1.default.workflow.findUnique({
                where: { id },
                include: { testCases: { orderBy: { sortOrder: 'asc' } } },
            });
            if (!workflow)
                return res.status(404).json({ error: 'Workflow not found' });
            const definition = (0, linear_to_definition_1.buildLinearWorkflowDefinition)(workflow.id, workflow.name, workflow.testCases.map((w) => w.testCaseId));
            const updated = await db_1.default.workflow.update({
                where: { id },
                data: { definition: JSON.stringify(definition), version: { increment: 1 } },
            });
            res.json(updated);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async deleteWorkflow(req, res) {
        try {
            const { id } = req.params;
            await db_1.default.workflow.delete({ where: { id } });
            res.status(204).send();
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async addTestCaseToWorkflow(req, res) {
        try {
            const { id } = req.params;
            const { testCaseId } = req.body;
            // Get max sort order
            const agg = await db_1.default.workflowTestCase.aggregate({
                where: { workflowId: id },
                _max: { sortOrder: true }
            });
            const sortOrder = (agg._max.sortOrder ?? -1) + 1;
            const wtc = await db_1.default.workflowTestCase.create({
                data: {
                    workflowId: id,
                    testCaseId,
                    sortOrder
                },
                include: { testCase: true }
            });
            res.status(201).json(wtc);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async removeTestCaseFromWorkflow(req, res) {
        try {
            const { id, testCaseId } = req.params;
            // We are finding by workflowId and testCaseId, but there might be multiple of the same test case.
            // Assuming we just delete all references or a specific relation id.
            // To keep it simple, we'll assume the frontend passes the `workflowTestCase.id` instead of `testCaseId`.
            // Let's adjust the route to take the relation ID: `/workflows/:id/test-cases/:relationId`
            const { relationId } = req.params;
            await db_1.default.workflowTestCase.delete({
                where: { id: relationId }
            });
            res.status(204).send();
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async updateWorkflowTestCasesOrder(req, res) {
        try {
            const { id } = req.params;
            // Expected: array of relation IDs in the new order
            const { relationIds } = req.body;
            await db_1.default.$transaction(relationIds.map((relationId, index) => db_1.default.workflowTestCase.update({
                where: { id: relationId },
                data: { sortOrder: index }
            })));
            const workflow = await db_1.default.workflow.findUnique({
                where: { id },
                include: {
                    testCases: {
                        include: { testCase: true },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });
            res.json(workflow);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    static async executeWorkflow(req, res) {
        try {
            const { id } = req.params;
            const { environmentId, headed, workers } = req.body;
            const workflow = await db_1.default.workflow.findUnique({
                where: { id },
                include: { testCases: { orderBy: { sortOrder: 'asc' } } },
            });
            if (!workflow) {
                return res.status(404).json({ error: 'Workflow not found' });
            }
            const hasDefinition = (0, definition_validator_1.hasControlFlowDefinition)(workflow.definition);
            if (!hasDefinition && workflow.testCases.length === 0) {
                return res.status(400).json({ error: 'Workflow has no control-flow definition or test cases' });
            }
            const run = await db_1.default.executionRun.create({
                data: {
                    projectId: workflow.projectId,
                    environmentId: environmentId || null,
                    workflowId: workflow.id,
                    status: 'PENDING',
                    triggerType: 'MANUAL',
                    executionMode: hasDefinition ? 'WORKFLOW' : 'LINEAR',
                }
            });
            (0, execution_router_1.startExecution)({
                runId: run.id,
                projectId: workflow.projectId,
                environmentId: environmentId || null,
                workflowId: workflow.id,
                workflowDefinition: workflow.definition,
                headed: headed === true,
                workers: workers && workers > 0 ? workers : 1,
                onLog: (logLine) => ws_1.wsManager.streamLog(run.id, logLine),
                onStatusChange: (status) => ws_1.wsManager.streamStatus(run.id, status),
            });
            res.status(202).json(run);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}
exports.WorkflowController = WorkflowController;
