import archiver from 'archiver';
import { Response } from 'express';
import prisma from '../db';
import {
  buildFrameworkScaffold,
  extractSelectorsFromUiSteps,
  inferFeatureFolder,
  inferSpecFileName,
} from './framework-scaffold';
import { PlaywrightGenerator } from './playwright-generator';

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'test';

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

export class GeneratorService {
  public static async generatePreview(projectId: string) {
    const files = await this.generateFileContents(projectId);
    return Object.entries(files)
      .map(([path, content]) => ({ path, content }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  public static async downloadProjectAsZip(projectId: string, res: Response) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const files = await this.generateFileContents(projectId);
    const zipName = `${slugify(project.name)}-playwright-framework.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      throw err;
    });
    archive.pipe(res);

    for (const [path, content] of Object.entries(files)) {
      archive.append(content, { name: path });
    }

    await archive.finalize();
  }

  private static async generateFileContents(projectId: string): Promise<Record<string, string>> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        testCases: { orderBy: { sortOrder: 'asc' } },
        environments: true,
        workflows: {
          include: {
            testCases: {
              include: { testCase: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        sharedMethods: true,
      },
    });

    if (!project) throw new Error('Project not found');

    const sharedMethods = project.sharedMethods.map((m) => ({
      id: m.id,
      name: m.name,
      uiSteps: m.uiSteps,
    }));

    const workflowTcIds = new Set(
      project.workflows.flatMap((w) => w.testCases.map((wtc) => wtc.testCaseId))
    );
    const standaloneTcs = project.testCases.filter((tc) => !workflowTcIds.has(tc.id));
    const standaloneApiTcs = standaloneTcs.filter(
      (tc) => tc.testType !== 'UI' && tc.method !== 'UI'
    );
    const standaloneUiTcs = standaloneTcs.filter(
      (tc) => tc.testType === 'UI' || tc.method === 'UI'
    );
    const workflowSpecs = project.workflows.filter((w) => w.testCases.length > 0);

    if (
      standaloneApiTcs.length === 0 &&
      standaloneUiTcs.length === 0 &&
      workflowSpecs.length === 0
    ) {
      throw new Error('No test cases or workflows to export. Add tests before downloading.');
    }

    const allUiTcs = project.testCases.filter((tc) => tc.testType === 'UI' || tc.method === 'UI');
    let loginSelectors: Record<string, string> = {};
    let dashboardSelectors: Record<string, string> = {};
    for (const tc of allUiTcs) {
      const sels = extractSelectorsFromUiSteps(tc.uiSteps);
      const folder = inferFeatureFolder(tc);
      if (folder === 'login') loginSelectors = { ...loginSelectors, ...sels };
      if (folder === 'dashboard') dashboardSelectors = { ...dashboardSelectors, ...sels };
    }

    const files = buildFrameworkScaffold({
      projectName: project.name,
      baseUrl: project.baseUrl,
      variables: parseJson(project.variables, {}),
      defaultHeaders: parseJson(project.defaultHeaders, {}),
      hasUi: allUiTcs.length > 0,
      hasApi: project.testCases.some((tc) => tc.testType !== 'UI' && tc.method !== 'UI'),
      loginSelectors,
      dashboardSelectors,
    });

    const usedSpecPaths = new Set<string>();

    const addSpec = (folder: string, fileName: string, content: string) => {
      let path = `playwright-framework/tests/${folder}/${fileName}`;
      if (usedSpecPaths.has(path)) {
        const base = fileName.replace(/\.spec\.ts$/, '');
        let n = 2;
        while (usedSpecPaths.has(`playwright-framework/tests/${folder}/${base}-${n}.spec.ts`)) n++;
        path = `playwright-framework/tests/${folder}/${base}-${n}.spec.ts`;
      }
      usedSpecPaths.add(path);
      files[path] = content;
    };

    for (const tc of standaloneApiTcs) {
      const folder = inferFeatureFolder(tc);
      const fileName = inferSpecFileName(tc);
      addSpec(
        folder,
        fileName,
        PlaywrightGenerator.generateSpec('export', project, null, [tc], sharedMethods)
      );
    }

    for (const tc of standaloneUiTcs) {
      const folder = inferFeatureFolder(tc);
      const fileName = inferSpecFileName(tc);
      addSpec(
        folder,
        fileName,
        PlaywrightGenerator.generateSpec('export', project, null, [tc], sharedMethods)
      );
    }

    for (const wf of workflowSpecs) {
      const wfTestCases = wf.testCases.map((wtc) => wtc.testCase);
      const folder = wfTestCases.every((tc) => tc.testType !== 'UI' && tc.method !== 'UI')
        ? 'api'
        : inferFeatureFolder(wfTestCases[0]);
      addSpec(
        folder,
        `${slugify(wf.name)}.spec.ts`,
        PlaywrightGenerator.generateSpec('export', project, null, wfTestCases, sharedMethods)
      );
    }

    return files;
  }
}
