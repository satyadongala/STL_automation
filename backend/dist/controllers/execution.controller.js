"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.stopExecution = exports.getExecutionSpans = exports.getExecutionById = exports.getExecutions = exports.triggerExecution = void 0;
const db_1 = __importDefault(require("../db"));
const execution_router_1 = require("../services/execution-router");
const ws_1 = require("../ws");
const triggerExecution = async (req, res) => {
    try {
        const { projectId, environmentId, testCaseIds, grepPattern, workflowId, headed, workers } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }
        // 1. Create the ExecutionRun database entry in PENDING state
        const run = await db_1.default.executionRun.create({
            data: {
                projectId,
                environmentId: environmentId || null,
                workflowId: workflowId || null,
                status: 'PENDING',
                triggerType: 'MANUAL'
            }
        });
        let workflowDefinition = null;
        if (workflowId) {
            const workflow = await db_1.default.workflow.findUnique({
                where: { id: workflowId },
                select: { definition: true },
            });
            workflowDefinition = workflow?.definition ?? null;
        }
        (0, execution_router_1.startExecution)({
            runId: run.id,
            projectId,
            environmentId: environmentId || null,
            workflowId: workflowId || null,
            workflowDefinition,
            testCaseIds,
            grepPattern,
            headed: headed === true,
            workers,
            onLog: (logLine) => ws_1.wsManager.streamLog(run.id, logLine),
            onStatusChange: (status) => ws_1.wsManager.streamStatus(run.id, status),
        });
        ws_1.wsManager.streamLog(run.id, `[SYS] Headed mode requested: ${headed === true}\n`);
        // Return the run details immediately
        res.status(202).json(run);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.triggerExecution = triggerExecution;
const getExecutions = async (req, res) => {
    try {
        const { projectId, limit } = req.query;
        const where = {};
        if (projectId)
            where.projectId = String(projectId);
        const runs = await db_1.default.executionRun.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit ? Number(limit) : undefined,
            include: {
                project: { select: { name: true } },
                environment: { select: { name: true } },
                workflow: { select: { name: true } }
            }
        });
        res.json(runs);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getExecutions = getExecutions;
const getExecutionById = async (req, res) => {
    try {
        const { id } = req.params;
        const run = await db_1.default.executionRun.findUnique({
            where: { id },
            include: {
                project: true,
                environment: true,
                workflow: true,
                results: {
                    include: { testCase: true },
                    orderBy: { testCase: { sortOrder: 'asc' } }
                },
                spans: {
                    orderBy: { startedAt: 'asc' }
                }
            }
        });
        if (!run)
            return res.status(404).json({ error: 'Execution run not found' });
        res.json(run);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getExecutionById = getExecutionById;
const getExecutionSpans = async (req, res) => {
    try {
        const { id } = req.params;
        const spans = await db_1.default.executionSpan.findMany({
            where: { executionRunId: id },
            orderBy: { startedAt: 'asc' },
        });
        res.json(spans);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getExecutionSpans = getExecutionSpans;
const stopExecution = async (req, res) => {
    try {
        const { id } = req.params;
        const killed = (0, execution_router_1.stopExecution)(id);
        if (killed) {
            // Update DB state
            await db_1.default.executionRun.update({
                where: { id },
                data: { status: 'FAILED', completedAt: new Date() }
            });
            ws_1.wsManager.streamStatus(id, 'FAILED');
            ws_1.wsManager.streamLog(id, '\n[SYS] Execution aborted by user.\n');
            res.json({ message: 'Execution stopped successfully' });
        }
        else {
            res.status(400).json({ error: 'Execution is not running or already completed' });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.stopExecution = stopExecution;
const getDashboardStats = async (req, res) => {
    try {
        const projectsCount = await db_1.default.project.count();
        const testCasesCount = await db_1.default.testCase.count();
        const runsCount = await db_1.default.executionRun.count();
        // Summary of run statuses
        const completedRuns = await db_1.default.executionRun.findMany({
            where: { status: { in: ['COMPLETED', 'FAILED'] } }
        });
        let totalTestsExecuted = 0;
        let totalTestsPassed = 0;
        let totalTestsFailed = 0;
        completedRuns.forEach((run) => {
            totalTestsExecuted += run.summaryTotal;
            totalTestsPassed += run.summaryPassed;
            totalTestsFailed += run.summaryFailed;
        });
        const successRate = totalTestsExecuted > 0
            ? Math.round((totalTestsPassed / totalTestsExecuted) * 100)
            : 0;
        // Last 5 runs
        const recentRuns = await db_1.default.executionRun.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
                project: { select: { name: true } },
                environment: { select: { name: true } }
            }
        });
        // Run distribution by date (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dailyRuns = await db_1.default.executionRun.findMany({
            where: {
                createdAt: { gte: sevenDaysAgo }
            },
            select: {
                createdAt: true,
                status: true,
                summaryPassed: true,
                summaryFailed: true
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json({
            counters: {
                projects: projectsCount,
                testCases: testCasesCount,
                runs: runsCount,
                successRate
            },
            recentRuns,
            dailyRuns
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.getDashboardStats = getDashboardStats;
