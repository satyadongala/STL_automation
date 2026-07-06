import { Request, Response } from 'express';
import prisma from '../db';

export const getEnvironments = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const environments = await prisma.environment.findMany({
      where: { projectId: String(projectId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json(environments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createEnvironment = async (req: Request, res: Response) => {
  try {
    const { projectId, name, baseUrl, headers, variables } = req.body;

    if (!projectId || !name || !baseUrl) {
      return res.status(400).json({ error: 'projectId, name, and baseUrl are required' });
    }

    const env = await prisma.environment.create({
      data: {
        projectId,
        name,
        baseUrl,
        headers: headers ? JSON.stringify(headers) : '{}',
        variables: variables ? JSON.stringify(variables) : '{}'
      }
    });
    res.status(201).json(env);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEnvironment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, baseUrl, headers, variables } = req.body;

    const env = await prisma.environment.update({
      where: { id },
      data: {
        name,
        baseUrl,
        headers: headers ? JSON.stringify(headers) : undefined,
        variables: variables ? JSON.stringify(variables) : undefined
      }
    });
    res.json(env);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteEnvironment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.environment.delete({ where: { id } });
    res.json({ message: 'Environment deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
