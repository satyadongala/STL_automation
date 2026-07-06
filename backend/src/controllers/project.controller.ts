import { Request, Response } from 'express';
import prisma from '../db';
import { ensurePlaywrightBrowsersBackground } from '../services/playwright-setup';

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { environments: true, testCases: { orderBy: { sortOrder: 'asc' } } }
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createProject = async (req: Request, res: Response) => {
  try {
    const { projectType, name, description, baseUrl, defaultHeaders, variables } = req.body;
    const normalizedProjectType = projectType === 'UI' ? 'UI' : 'API';
    
    if (!name || !baseUrl) {
      return res.status(400).json({ error: 'Name and Base URL are required' });
    }

    const project = await prisma.project.create({
      data: {
        projectType: normalizedProjectType,
        name,
        description,
        baseUrl,
        defaultHeaders: defaultHeaders ? JSON.stringify(defaultHeaders) : '{}',
        variables: variables ? JSON.stringify(variables) : '{}'
      }
    });

    if (normalizedProjectType === 'UI') {
      ensurePlaywrightBrowsersBackground();
    }

    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { projectType, name, description, baseUrl, defaultHeaders, variables } = req.body;
    const normalizedProjectType = projectType === 'UI' ? 'UI' : projectType === 'API' ? 'API' : undefined;

    const project = await prisma.project.update({
      where: { id },
      data: {
        projectType: normalizedProjectType,
        name,
        description,
        baseUrl,
        defaultHeaders: defaultHeaders ? JSON.stringify(defaultHeaders) : undefined,
        variables: variables ? JSON.stringify(variables) : undefined
      }
    });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.project.delete({ where: { id } });
    res.json({ message: 'Project deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
