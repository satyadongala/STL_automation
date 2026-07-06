"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratorService = void 0;
const archiver_1 = __importDefault(require("archiver"));
const db_1 = __importDefault(require("../db"));
const framework_scaffold_1 = require("./framework-scaffold");
const playwright_generator_1 = require("./playwright-generator");
const slugify = (name) => name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'test';
const parseJson = (value, fallback) => {
    try {
        return value ? JSON.parse(value) : fallback;
    }
    catch {
        return fallback;
    }
};
class GeneratorService {
    static async generatePreview(projectId) {
        const files = await this.generateFileContents(projectId);
        return Object.entries(files)
            .map(([path, content]) => ({ path, content }))
            .sort((a, b) => a.path.localeCompare(b.path));
    }
    static async downloadProjectAsZip(projectId, res) {
        const project = await db_1.default.project.findUnique({ where: { id: projectId } });
        if (!project)
            throw new Error('Project not found');
        const files = await this.generateFileContents(projectId);
        const zipName = `${slugify(project.name)}-playwright-framework.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            throw err;
        });
        archive.pipe(res);
        for (const [path, content] of Object.entries(files)) {
            archive.append(content, { name: path });
        }
        await archive.finalize();
    }
    static async generateFileContents(projectId) {
        const project = await db_1.default.project.findUnique({
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
        if (!project)
            throw new Error('Project not found');
        const sharedMethods = project.sharedMethods.map((m) => ({
            id: m.id,
            name: m.name,
            uiSteps: m.uiSteps,
        }));
        const workflowTcIds = new Set(project.workflows.flatMap((w) => w.testCases.map((wtc) => wtc.testCaseId)));
        const standaloneTcs = project.testCases.filter((tc) => !workflowTcIds.has(tc.id));
        const standaloneApiTcs = standaloneTcs.filter((tc) => tc.testType !== 'UI' && tc.method !== 'UI');
        const standaloneUiTcs = standaloneTcs.filter((tc) => tc.testType === 'UI' || tc.method === 'UI');
        const workflowSpecs = project.workflows.filter((w) => w.testCases.length > 0);
        if (standaloneApiTcs.length === 0 &&
            standaloneUiTcs.length === 0 &&
            workflowSpecs.length === 0) {
            throw new Error('No test cases or workflows to export. Add tests before downloading.');
        }
        const allUiTcs = project.testCases.filter((tc) => tc.testType === 'UI' || tc.method === 'UI');
        let loginSelectors = {};
        let dashboardSelectors = {};
        for (const tc of allUiTcs) {
            const sels = (0, framework_scaffold_1.extractSelectorsFromUiSteps)(tc.uiSteps);
            const folder = (0, framework_scaffold_1.inferFeatureFolder)(tc);
            if (folder === 'login')
                loginSelectors = { ...loginSelectors, ...sels };
            if (folder === 'dashboard')
                dashboardSelectors = { ...dashboardSelectors, ...sels };
        }
        const files = (0, framework_scaffold_1.buildFrameworkScaffold)({
            projectName: project.name,
            baseUrl: project.baseUrl,
            variables: parseJson(project.variables, {}),
            defaultHeaders: parseJson(project.defaultHeaders, {}),
            hasUi: allUiTcs.length > 0,
            hasApi: project.testCases.some((tc) => tc.testType !== 'UI' && tc.method !== 'UI'),
            loginSelectors,
            dashboardSelectors,
        });
        const usedSpecPaths = new Set();
        const addSpec = (folder, fileName, content) => {
            let path = `playwright-framework/tests/${folder}/${fileName}`;
            if (usedSpecPaths.has(path)) {
                const base = fileName.replace(/\.spec\.ts$/, '');
                let n = 2;
                while (usedSpecPaths.has(`playwright-framework/tests/${folder}/${base}-${n}.spec.ts`))
                    n++;
                path = `playwright-framework/tests/${folder}/${base}-${n}.spec.ts`;
            }
            usedSpecPaths.add(path);
            files[path] = content;
        };
        for (const tc of standaloneApiTcs) {
            const folder = (0, framework_scaffold_1.inferFeatureFolder)(tc);
            const fileName = (0, framework_scaffold_1.inferSpecFileName)(tc);
            addSpec(folder, fileName, playwright_generator_1.PlaywrightGenerator.generateSpec('export', project, null, [tc], sharedMethods));
        }
        for (const tc of standaloneUiTcs) {
            const folder = (0, framework_scaffold_1.inferFeatureFolder)(tc);
            const fileName = (0, framework_scaffold_1.inferSpecFileName)(tc);
            addSpec(folder, fileName, playwright_generator_1.PlaywrightGenerator.generateSpec('export', project, null, [tc], sharedMethods));
        }
        for (const wf of workflowSpecs) {
            const wfTestCases = wf.testCases.map((wtc) => wtc.testCase);
            const folder = wfTestCases.every((tc) => tc.testType !== 'UI' && tc.method !== 'UI')
                ? 'api'
                : (0, framework_scaffold_1.inferFeatureFolder)(wfTestCases[0]);
            addSpec(folder, `${slugify(wf.name)}.spec.ts`, playwright_generator_1.PlaywrightGenerator.generateSpec('export', project, null, wfTestCases, sharedMethods));
        }
        return files;
    }
}
exports.GeneratorService = GeneratorService;
