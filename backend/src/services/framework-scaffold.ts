type ScaffoldContext = {
  projectName: string;
  baseUrl: string;
  variables: Record<string, string>;
  defaultHeaders: Record<string, string>;
  hasUi: boolean;
  hasApi: boolean;
  loginSelectors: Record<string, string>;
  dashboardSelectors: Record<string, string>;
};

const ROOT = 'playwright-framework';

export const frameworkRoot = ROOT;

export function buildFrameworkScaffold(ctx: ScaffoldContext): Record<string, string> {
  const files: Record<string, string> = {};

  files[`${ROOT}/package.json`] = JSON.stringify(
    {
      name: ctx.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      version: '1.0.0',
      description: `Playwright automation — ${ctx.projectName}`,
        scripts: {
          test: 'playwright test',
          'test:headed': 'playwright test --headed',
          'test:ui': 'playwright test --ui',
          'test:report': 'playwright show-report',
          'test:allure': 'allure generate reports/allure-results -o reports/allure --clean',
          'test:allure:open': 'allure open reports/allure',
          postinstall: 'playwright install chromium',
        },
        devDependencies: {
          '@playwright/test': '^1.49.0',
          '@types/node': '^22.0.0',
          typescript: '^5.6.0',
          'allure-playwright': '^3.0.0',
          'allure-commandline': '^2.32.0',
        },
    },
    null,
    2
  );

  files[`${ROOT}/tsconfig.json`] = JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'commonjs',
        moduleResolution: 'node',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        baseUrl: '.',
        paths: {
          '@pages/*': ['pages/*'],
          '@fixtures/*': ['fixtures/*'],
          '@utils/*': ['utils/*'],
          '@locators/*': ['locators/*'],
          '@data/*': ['data/*'],
        },
        types: ['node', '@playwright/test'],
      },
      include: ['**/*.ts'],
    },
    null,
    2
  );

  files[`${ROOT}/.gitignore`] = [
    'node_modules/',
    'test-results/',
    'playwright-report/',
    'reports/html/',
    'reports/allure/',
    'reports/allure-results/',
    'reports/screenshots/',
    '.env.local',
    '.DS_Store',
  ].join('\n');

  files[`${ROOT}/.env`] = [
    `BASE_URL=${ctx.baseUrl}`,
    'HEADLESS=true',
    'WORKERS=1',
  ].join('\n');

  files[`${ROOT}/playwright.config.ts`] = generatePlaywrightConfig(ctx);
  files[`${ROOT}/README.md`] = generateReadme(ctx);

  // pages
  files[`${ROOT}/pages/BasePage.ts`] = basePageTs();
  files[`${ROOT}/pages/HomePage.ts`] = homePageTs();
  files[`${ROOT}/pages/LoginPage.ts`] = loginPageTs(ctx);
  files[`${ROOT}/pages/DashboardPage.ts`] = dashboardPageTs(ctx);

  // fixtures
  files[`${ROOT}/fixtures/baseFixture.ts`] = baseFixtureTs();
  files[`${ROOT}/fixtures/testData.ts`] = testDataTs(ctx);

  // utils
  files[`${ROOT}/utils/logger.ts`] = loggerTs();
  files[`${ROOT}/utils/helpers.ts`] = helpersTs();
  files[`${ROOT}/utils/constants.ts`] = constantsTs(ctx);
  files[`${ROOT}/utils/randomData.ts`] = randomDataTs();

  // data
  files[`${ROOT}/data/users.json`] = JSON.stringify(
    {
      validUser: { username: 'Admin', password: 'admin123' },
      invalidUser: { username: 'invalid', password: 'wrong' },
    },
    null,
    2
  );
  files[`${ROOT}/data/config.json`] = JSON.stringify(
    {
      baseUrl: ctx.baseUrl,
      defaultHeaders: ctx.defaultHeaders,
      variables: ctx.variables,
      timeouts: { default: 30000, navigation: 60000 },
    },
    null,
    2
  );
  files[`${ROOT}/data/products.json`] = JSON.stringify({ products: [] }, null, 2);

  // locators
  files[`${ROOT}/locators/loginLocators.ts`] = loginLocatorsTs(ctx);
  files[`${ROOT}/locators/dashboardLocators.ts`] = dashboardLocatorsTs(ctx);

  // hooks
  files[`${ROOT}/hooks/beforeEach.ts`] = beforeEachTs();
  files[`${ROOT}/hooks/afterEach.ts`] = afterEachTs();

  // empty report / output dirs
  for (const dir of [
    'reports/html',
    'reports/allure-results',
    'reports/screenshots',
    'test-results',
  ]) {
    files[`${ROOT}/${dir}/.gitkeep`] = '';
  }

  return files;
}

export function inferFeatureFolder(tc: { name: string; path: string; testType?: string; method: string }): string {
  const blob = `${tc.name} ${tc.path}`.toLowerCase();
  if (tc.testType !== 'UI' && tc.method !== 'UI') return 'api';
  if (/logout|sign.?out|log.?out/.test(blob)) return 'login';
  if (/login|sign.?in|auth/.test(blob)) return 'login';
  if (/dashboard|home|landing/.test(blob)) return 'dashboard';
  return 'ui';
}

export function inferSpecFileName(tc: { name: string }): string {
  const name = tc.name.toLowerCase();
  if (/logout|sign.?out/.test(name)) return 'logout.spec.ts';
  if (/login|sign.?in/.test(name)) return 'login.spec.ts';
  if (/dashboard/.test(name)) return 'dashboard.spec.ts';
  return `${tc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test'}.spec.ts`;
}

export function extractSelectorsFromUiSteps(uiStepsJson: string): Record<string, string> {
  const selectors: Record<string, string> = {};
  try {
    const steps = JSON.parse(uiStepsJson || '[]') as Array<{ action?: string; selector?: string }>;
    let fillIndex = 0;
    for (const step of steps) {
      if (!step.selector) continue;
      if (step.action === 'fill') {
        selectors[fillIndex === 0 ? 'username' : 'password'] = step.selector;
        fillIndex++;
      } else if (step.action === 'click') {
        selectors.submitButton = step.selector;
      } else if (!selectors.element) {
        selectors.element = step.selector;
      }
    }
  } catch {
    /* ponytail: skip bad JSON */
  }
  return selectors;
}

function generatePlaywrightConfig(ctx: ScaffoldContext): string {
  return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['allure-playwright', { resultsDir: 'reports/allure-results', detail: true, suiteTitle: true }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.BASE_URL,
    headless: process.env.HEADLESS !== 'false',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: '${ctx.projectName.replace(/'/g, "\\'")}',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
`;
}

function generateReadme(ctx: ScaffoldContext): string {
  return `# ${ctx.projectName} — Playwright Framework

Standard Page Object Model framework generated from STL Automation Platform.

## Structure

\`\`\`
playwright-framework/
├── tests/          Feature-based test specs (UI + API)
├── pages/          Page Object classes
├── fixtures/       Custom Playwright fixtures
├── utils/          Helpers, logger, constants
├── data/           Test data JSON files
├── locators/       Centralized selectors
├── hooks/          beforeEach / afterEach hooks
├── reports/        HTML, Allure, screenshots
└── test-results/   Playwright run artifacts
\`\`\`

## Setup

\`\`\`bash
cd playwright-framework
npm install
\`\`\`

Base URL is set in \`.env\`: \`${ctx.baseUrl}\`

## Run

\`\`\`bash
npm test
npm run test:headed
npm run test:report
npm run test:allure        # generate Allure HTML
npm run test:allure:open   # open Allure in browser
\`\`\`

Run by feature:

\`\`\`bash
npx playwright test tests/login
npx playwright test tests/api
\`\`\`
`;
}

function basePageTs(): string {
  return `import { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path = '/') {
    await this.page.goto(path);
  }

  locator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }
}
`;
}

function homePageTs(): string {
  return `import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class HomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto('/');
  }
}
`;
}

function loginPageTs(_ctx: ScaffoldContext): string {
  return `import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { loginLocators } from '../locators/loginLocators';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(path = '/login') {
    await this.goto(path);
  }

  async login(username: string, password: string) {
    await this.page.locator(loginLocators.username).fill(username);
    await this.page.locator(loginLocators.password).fill(password);
    await this.page.locator(loginLocators.submitButton).click();
  }

  async isLoaded() {
    await this.page.locator(loginLocators.username).waitFor({ state: 'visible' });
  }
}
`;
}

function dashboardPageTs(ctx: ScaffoldContext): string {
  return `import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { dashboardLocators } from '../locators/dashboardLocators';

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async isLoaded() {
    await this.page.locator(dashboardLocators.header).waitFor({ state: 'visible' });
  }

  async getHeaderText() {
    return this.page.locator(dashboardLocators.header).innerText();
  }
}
`;
}

function baseFixtureTs(): string {
  return `import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { HomePage } from '../pages/HomePage';
import { runBeforeEach } from '../hooks/beforeEach';
import { runAfterEach } from '../hooks/afterEach';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  homePage: HomePage;
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
});

test.beforeEach(async ({ page }, testInfo) => {
  await runBeforeEach(page, testInfo);
});

test.afterEach(async ({ page }, testInfo) => {
  await runAfterEach(page, testInfo);
});

export { expect } from '@playwright/test';
`;
}

function testDataTs(ctx: ScaffoldContext): string {
  return `import users from '../data/users.json';
import config from '../data/config.json';

export const testData = {
  users,
  config,
  baseUrl: process.env.BASE_URL || config.baseUrl || '${ctx.baseUrl.replace(/'/g, "\\'")}',
};
`;
}

function loggerTs(): string {
  return `export const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(\`[INFO] \${msg}\`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(\`[WARN] \${msg}\`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(\`[ERROR] \${msg}\`, ...args),
  step: (msg: string) => console.log(\`  → \${msg}\`),
};
`;
}

function helpersTs(): string {
  return `export function buildUrl(base: string, path: string): string {
  const b = base.replace(/\\/+$/, '');
  if (!path) return b;
  if (path.startsWith('?') || path.startsWith('#')) return \`\${b}\${path}\`;
  const p = path.replace(/^\\/+/, '');
  return p ? \`\${b}/\${p}\` : b;
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}
`;
}

function constantsTs(ctx: ScaffoldContext): string {
  return `export const TIMEOUTS = {
  default: 30_000,
  navigation: 60_000,
} as const;

export const BASE_URL = process.env.BASE_URL || '${ctx.baseUrl.replace(/'/g, "\\'")}';

export const DEFAULT_HEADERS: Record<string, string> = ${JSON.stringify(ctx.defaultHeaders, null, 2)};
`;
}

function randomDataTs(): string {
  return `export function randomString(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

export function randomEmail(): string {
  return \`user_\${randomString()}@test.com\`;
}
`;
}

function loginLocatorsTs(ctx: ScaffoldContext): string {
  const s = ctx.loginSelectors;
  return `export const loginLocators = {
  username: '${(s.username || "input[name='username']").replace(/'/g, "\\'")}',
  password: '${(s.password || "input[name='password']").replace(/'/g, "\\'")}',
  submitButton: '${(s.submitButton || "button[type='submit']").replace(/'/g, "\\'")}',
  errorMessage: '.oxd-alert-content-text',
} as const;
`;
}

function dashboardLocatorsTs(ctx: ScaffoldContext): string {
  const s = ctx.dashboardSelectors;
  return `export const dashboardLocators = {
  header: '${(s.element || '.oxd-topbar-header-breadcrumb-module').replace(/'/g, "\\'")}',
  sidebar: '.oxd-sidebar',
  userDropdown: '.oxd-userdropdown-tab',
} as const;
`;
}

function beforeEachTs(): string {
  return `import { Page, TestInfo } from '@playwright/test';
import { logger } from '../utils/logger';

export async function runBeforeEach(page: Page, testInfo: TestInfo) {
  logger.info(\`Starting: \${testInfo.title}\`);
}
`;
}

function afterEachTs(): string {
  return `import { Page, TestInfo } from '@playwright/test';
import { logger } from '../utils/logger';

export async function runAfterEach(page: Page, testInfo: TestInfo) {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    if (screenshot) {
      await testInfo.attach('failure-screenshot', { body: screenshot, contentType: 'image/png' });
    }
  }
  logger.info(\`Finished: \${testInfo.title} [\${testInfo.status}]\`);
}
`;
}
