import { Request, Response } from 'express';
import prisma from '../db';
import { startExecution, stopExecution as stopRun } from '../services/execution-router';
import { wsManager } from '../ws';
import { resolveHeaded } from '../utils/headed';
import {
  resolveArtifactMode,
  toPlaywrightScreenshot,
  toPlaywrightTrace,
  toPlaywrightVideo,
} from '../utils/playwright-artifacts';

export const triggerExecution = async (req: Request, res: Response) => {
  try {
    const { projectId, environmentId, testCaseIds, grepPattern, workflowId, headed, workers, video, trace, screenshot } = req.body;
    const headedMode = resolveHeaded(headed);
    const videoMode = resolveArtifactMode(video, 'off');
    const traceMode = resolveArtifactMode(trace, 'failed');
    const screenshotMode = resolveArtifactMode(screenshot, 'failed');

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // 1. Create the ExecutionRun database entry in PENDING state
    const run = await prisma.executionRun.create({
      data: {
        projectId,
        environmentId: environmentId || null,
        workflowId: workflowId || null,
        status: 'PENDING',
        triggerType: 'MANUAL',
        headed: headedMode,
      }
    });

    let workflowDefinition: string | null = null;
    if (workflowId) {
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { definition: true },
      });
      workflowDefinition = workflow?.definition ?? null;
    }

    wsManager.streamLog(run.id, `[SYS] Headed mode requested: ${headedMode}\n`);
    wsManager.streamLog(run.id, `[SYS] Artifacts — video: ${videoMode}, trace: ${traceMode}, screenshot: ${screenshotMode}\n`);
    startExecution({
      runId: run.id,
      projectId,
      environmentId: environmentId || null,
      workflowId: workflowId || null,
      workflowDefinition,
      testCaseIds,
      grepPattern,
      headed: headedMode,
      workers,
      video: videoMode,
      trace: traceMode,
      screenshot: screenshotMode,
      onLog: (logLine) => wsManager.streamLog(run.id, logLine),
      onStatusChange: (status) => wsManager.streamStatus(run.id, status),
    });

    // Return the run details immediately
    res.status(202).json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getExecutions = async (req: Request, res: Response) => {
  try {
    const { projectId, limit } = req.query;

    const where: any = {};
    if (projectId) where.projectId = String(projectId);

    const runs = await prisma.executionRun.findMany({
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getExecutionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = await prisma.executionRun.findUnique({
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

    if (!run) return res.status(404).json({ error: 'Execution run not found' });
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getExecutionSpans = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const spans = await prisma.executionSpan.findMany({
      where: { executionRunId: id },
      orderBy: { startedAt: 'asc' },
    });
    res.json(spans);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const stopExecution = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const killed = stopRun(id);

    if (killed) {
      // Update DB state
      await prisma.executionRun.update({
        where: { id },
        data: { status: 'FAILED', completedAt: new Date() }
      });
      wsManager.streamStatus(id, 'FAILED');
      wsManager.streamLog(id, '\n[SYS] Execution aborted by user.\n');
      res.json({ message: 'Execution stopped successfully' });
    } else {
      res.status(400).json({ error: 'Execution is not running or already completed' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const projectsCount = await prisma.project.count();
    const testCasesCount = await prisma.testCase.count();
    const runsCount = await prisma.executionRun.count();

    // Summary of run statuses
    const completedRuns = await prisma.executionRun.findMany({
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
    const recentRuns = await prisma.executionRun.findMany({
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

    const dailyRuns = await prisma.executionRun.findMany({
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
