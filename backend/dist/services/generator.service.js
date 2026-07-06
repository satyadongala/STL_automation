"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeneratorService = void 0;
const archiver_1 = __importDefault(require("archiver"));
const db_1 = __importDefault(require("../db"));
const playwright_generator_1 = require("./playwright-generator");
class GeneratorService {
    /**
     * Generates a preview of the files that will be created.
     */
    static async generatePreview(projectId) {
        const files = await this.generateFileContents(projectId);
        return Object.keys(files).map(path => ({
            path,
            content: files[path]
        }));
    }
    /**
     * Streams a ZIP of the generated Playwright project to the provided response.
     */
    static async downloadProjectAsZip(projectId, res) {
        const files = await this.generateFileContents(projectId);
        const project = await db_1.default.project.findUnique({ where: { id: projectId } });
        const projectName = project?.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'api_project';
        res.attachment(`${projectName}_playwright.zip`);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            res.status(500).send({ error: err.message });
        });
        archive.pipe(res);
        for (const [filePath, content] of Object.entries(files)) {
            archive.append(content, { name: filePath });
        }
        await archive.finalize();
    }
    /**
     * Core logic to gather data and generate all files.
     */
    static async generateFileContents(projectId) {
        const project = await db_1.default.project.findUnique({
            where: { id: projectId },
            include: {
                environments: true,
                workflows: {
                    include: {
                        testCases: {
                            include: { testCase: true },
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                },
                testCases: true
            }
        });
        if (!project)
            throw new Error('Project not found');
        const files = {};
        // 1. Package.json
        files['package.json'] = JSON.stringify({
            name: project.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
            version: "1.0.0",
            description: project.description || "Generated Playwright API Automation Project",
            scripts: {
                "test": "playwright test",
                "test:ui": "playwright test --ui",
                "test:report": "playwright show-report"
            },
            devDependencies: {
                "@playwright/test": "^1.42.0",
                "@types/node": "^20.0.0"
            }
        }, null, 2);
        // 2. Playwright Config
        // If environments exist, we can setup projects in playwright.config.ts
        let projectsConfig = `[
      {
        name: 'Default Environment',
        use: {
          baseURL: '${project.baseUrl}'
        }
      }
    ]`;
        if (project.environments.length > 0) {
            projectsConfig = `[\n` + project.environments.map(env => `      {
        name: '${env.name.replace(/'/g, "\\'")}',
        use: {
          baseURL: '${env.baseUrl}'
        }
      }`).join(',\n') + `\n    ]`;
        }
        files['playwright.config.ts'] = `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Enforce serial execution for variable passing
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: ${projectsConfig}
});
`;
        // 3. Readme
        files['README.md'] = `# ${project.name}

${project.description || 'Generated Playwright API Automation Project'}

## Setup
1. Run \`npm install\` to install dependencies.
2. Run \`npx playwright install\` if you haven't installed playwright browsers before (not strictly needed for API testing, but good practice).

## Running Tests
- Run all tests: \`npm test\`
- Run a specific environment: \`npx playwright test --project="Environment Name"\`
- View report: \`npm run test:report\`
`;
        // 4. Generate Workflow Tests. Workflows can contain API and UI steps, so
        // they are grouped separately from standalone API/UI tests.
        for (const workflow of project.workflows) {
            if (workflow.testCases.length === 0)
                continue;
            const tcs = workflow.testCases.map(wtc => wtc.testCase);
            const specContent = playwright_generator_1.PlaywrightGenerator.generateSpec(workflow.id, project, null, // BaseUrl handled by config, but headers/vars will be default
            tcs);
            const safeName = workflow.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            files[`tests/workflows/${safeName}.spec.ts`] = specContent;
        }
        // 5. Generate Standalone Tests (for test cases not in any workflow)
        const workflowTcIds = new Set(project.workflows.flatMap(w => w.testCases.map(wtc => wtc.testCaseId)));
        const standaloneTcs = project.testCases.filter(tc => !workflowTcIds.has(tc.id));
        const standaloneApiTcs = standaloneTcs.filter(tc => tc.testType !== 'UI' && tc.method !== 'UI');
        const standaloneUiTcs = standaloneTcs.filter(tc => tc.testType === 'UI' || tc.method === 'UI');
        if (standaloneApiTcs.length > 0) {
            const specContent = playwright_generator_1.PlaywrightGenerator.generateSpec('standalone-api', project, null, standaloneApiTcs);
            files['tests/api/standalone_api.spec.ts'] = specContent;
        }
        if (standaloneUiTcs.length > 0) {
            const specContent = playwright_generator_1.PlaywrightGenerator.generateSpec('standalone-ui', project, null, standaloneUiTcs);
            files['tests/ui/standalone_ui.spec.ts'] = specContent;
        }
        return files;
    }
}
exports.GeneratorService = GeneratorService;
