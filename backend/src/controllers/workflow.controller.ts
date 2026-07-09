import { Request, Response } from 'express';
import prisma from '../db';
import { startExecution } from '../services/execution-router';
import { resolveHeaded } from '../utils/headed';
import { hasControlFlowDefinition, parseWorkflowDefinition, DefinitionValidationError } from '../workflow/definition-validator';
import { buildLinearWorkflowDefinition } from '../workflow/linear-to-definition';
import { wsManager } from '../ws';

export class WorkflowController {
  public static async getWorkflows(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const workflows = await prisma.workflow.findMany({
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async getWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const workflow = await prisma.workflow.findUnique({
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
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
      res.json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async createWorkflow(req: Request, res: Response) {
    try {
      const { projectId } = req.params;
      const { name, description, definition } = req.body;
      if (definition) {
        const defString = typeof definition === 'string' ? definition : JSON.stringify(definition);
        if (defString !== '{}') parseWorkflowDefinition(defString);
      }
      const workflow = await prisma.workflow.create({
        data: {
          projectId,
          name,
          description,
          definition: definition ? JSON.stringify(definition) : '{}',
        }
      });
      res.status(201).json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async updateWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, definition, version } = req.body;
      const data: Record<string, unknown> = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (version !== undefined) data.version = version;
      if (definition !== undefined) {
        const defString = typeof definition === 'string' ? definition : JSON.stringify(definition);
        if (defString && defString !== '{}') parseWorkflowDefinition(defString);
        data.definition = defString;
      }
      const workflow = await prisma.workflow.update({
        where: { id },
        data,
      });
      res.json(workflow);
    } catch (error: any) {
      if (error instanceof DefinitionValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  public static async updateWorkflowDefinition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { definition } = req.body;
      const defString = typeof definition === 'string' ? definition : JSON.stringify(definition);
      parseWorkflowDefinition(defString);
      const workflow = await prisma.workflow.update({
        where: { id },
        data: { definition: defString, version: { increment: 1 } },
      });
      res.json(workflow);
    } catch (error: any) {
      if (error instanceof DefinitionValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  public static async convertLinearToDefinition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: { testCases: { orderBy: { sortOrder: 'asc' } } },
      });
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

      const definition = buildLinearWorkflowDefinition(
        workflow.id,
        workflow.name,
        workflow.testCases.map((w) => w.testCaseId)
      );

      const updated = await prisma.workflow.update({
        where: { id },
        data: { definition: JSON.stringify(definition), version: { increment: 1 } },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async deleteWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await prisma.workflow.delete({ where: { id } });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async addTestCaseToWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { testCaseId } = req.body;

      // Get max sort order
      const agg = await prisma.workflowTestCase.aggregate({
        where: { workflowId: id },
        _max: { sortOrder: true }
      });
      const sortOrder = (agg._max.sortOrder ?? -1) + 1;

      const wtc = await prisma.workflowTestCase.create({
        data: {
          workflowId: id,
          testCaseId,
          sortOrder
        },
        include: { testCase: true }
      });
      res.status(201).json(wtc);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async removeTestCaseFromWorkflow(req: Request, res: Response) {
    try {
      const { id, testCaseId } = req.params;
      // We are finding by workflowId and testCaseId, but there might be multiple of the same test case.
      // Assuming we just delete all references or a specific relation id.
      // To keep it simple, we'll assume the frontend passes the `workflowTestCase.id` instead of `testCaseId`.
      // Let's adjust the route to take the relation ID: `/workflows/:id/test-cases/:relationId`
      
      const { relationId } = req.params;
      await prisma.workflowTestCase.delete({
        where: { id: relationId }
      });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async updateWorkflowTestCasesOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      // Expected: array of relation IDs in the new order
      const { relationIds } = req.body; 

      await prisma.$transaction(
        relationIds.map((relationId: string, index: number) =>
          prisma.workflowTestCase.update({
            where: { id: relationId },
            data: { sortOrder: index }
          })
        )
      );
      
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: {
          testCases: {
            include: { testCase: true },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
      res.json(workflow);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public static async executeWorkflow(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { environmentId, headed, workers } = req.body;
      const headedMode = resolveHeaded(headed);

      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: { testCases: { orderBy: { sortOrder: 'asc' } } },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const hasDefinition = hasControlFlowDefinition(workflow.definition);
      if (!hasDefinition && workflow.testCases.length === 0) {
        return res.status(400).json({ error: 'Workflow has no control-flow definition or test cases' });
      }

      const run = await prisma.executionRun.create({
        data: {
          projectId: workflow.projectId,
          environmentId: environmentId || null,
          workflowId: workflow.id,
          status: 'PENDING',
          triggerType: 'MANUAL',
          executionMode: hasDefinition ? 'WORKFLOW' : 'LINEAR',
          headed: headedMode,
        }
      });

      wsManager.streamLog(run.id, `[SYS] Headed mode requested: ${headedMode}\n`);
      startExecution({
        runId: run.id,
        projectId: workflow.projectId,
        environmentId: environmentId || null,
        workflowId: workflow.id,
        workflowDefinition: workflow.definition,
        headed: headedMode,
        workers: workers && workers > 0 ? workers : 1,
        onLog: (logLine) => wsManager.streamLog(run.id, logLine),
        onStatusChange: (status) => wsManager.streamStatus(run.id, status),
      });

      res.status(202).json(run);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
