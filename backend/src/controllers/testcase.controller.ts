import { Request, Response } from 'express';
import prisma from '../db';

export const getTestCases = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const testCases = await prisma.testCase.findMany({
      where: { projectId: String(projectId) },
      orderBy: { sortOrder: 'asc' }
    });
    res.json(testCases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getTestCaseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const testCase = await prisma.testCase.findUnique({ where: { id } });
    if (!testCase) return res.status(404).json({ error: 'Test case not found' });
    res.json(testCase);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createTestCase = async (req: Request, res: Response) => {
  try {
    const { projectId, testType, name, description, method, path, headers, queryParams, body, assertions, variablesToExtract, uiSteps, sortOrder } = req.body;
    const normalizedTestType = testType === 'UI' ? 'UI' : 'API';

    if (!projectId || !name) {
      return res.status(400).json({ error: 'projectId and name are required' });
    }

    if (normalizedTestType === 'API' && !path) {
      return res.status(400).json({ error: 'path is required for API test cases' });
    }

    if (normalizedTestType === 'API' && !method) {
      return res.status(400).json({ error: 'method is required for API test cases' });
    }

    const testCase = await prisma.testCase.create({
      data: {
        projectId,
        testType: normalizedTestType,
        name,
        description,
        method: normalizedTestType === 'UI' ? 'UI' : method,
        path: path ?? '',
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTestCase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { testType, name, description, method, path, headers, queryParams, body, assertions, variablesToExtract, uiSteps, sortOrder } = req.body;
    const normalizedTestType = testType === 'UI' ? 'UI' : testType === 'API' ? 'API' : undefined;

    const testCase = await prisma.testCase.update({
      where: { id },
      data: {
        testType: normalizedTestType,
        name,
        description,
        method: normalizedTestType === 'UI' ? 'UI' : method,
        path: path ?? '',
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteTestCase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.testCase.delete({ where: { id } });
    res.json({ message: 'Test case deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const reorderTestCases = async (req: Request, res: Response) => {
  try {
    const { orders } = req.body; // Array of { id: string, sortOrder: number }
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders array is required' });
    }

    await prisma.$transaction(
      orders.map((item) =>
        prisma.testCase.update({
          where: { id: item.id },
          data: { sortOrder: Number(item.sortOrder) }
        })
      )
    );

    res.json({ message: 'Test cases reordered successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
