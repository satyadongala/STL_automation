import { Request, Response } from 'express';
import prisma from '../db';

export const getProjectSharedMethods = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const methods = await prisma.sharedMethod.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(methods);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSharedMethod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const method = await prisma.sharedMethod.findUnique({
      where: { id }
    });
    if (!method) return res.status(404).json({ error: 'Shared Method not found' });
    res.json(method);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createSharedMethod = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description, parameters, uiSteps } = req.body;

    const newMethod = await prisma.sharedMethod.create({
      data: {
        projectId,
        name,
        description,
        parameters: parameters ? JSON.stringify(parameters) : '[]',
        uiSteps: uiSteps ? JSON.stringify(uiSteps) : '[]',
      }
    });
    res.status(201).json(newMethod);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSharedMethod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, parameters, uiSteps } = req.body;

    // Optional: detect circular dependencies before saving
    // But since shared methods cannot currently be embedded in shared methods (based on UI for now), we can omit deep check here,
    // or add a check if we allow useMethod within useMethod.

    const updated = await prisma.sharedMethod.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(parameters !== undefined && { parameters: JSON.stringify(parameters) }),
        ...(uiSteps !== undefined && { uiSteps: JSON.stringify(uiSteps) }),
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteSharedMethod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.sharedMethod.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
