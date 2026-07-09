import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACES_ROOT =
  process.env.PROJECT_WORKSPACES_DIR || path.join(process.cwd(), 'project_workspaces');

export function getProjectWorkspacePath(projectId: string): string {
  return path.join(WORKSPACES_ROOT, projectId);
}

export function isPlaywrightProjectInitialized(projectId: string): boolean {
  return fs.existsSync(path.join(getProjectWorkspacePath(projectId), 'playwright.config.ts'));
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  onLog?: (msg: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
    });

    let stderr = '';
    child.stdout?.on('data', (d) => onLog?.(d.toString()));
    child.stderr?.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      onLog?.(s);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-800)}`));
    });
  });
}

function pinnedPlaywrightVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const raw =
      pkg.dependencies?.['@playwright/test'] || pkg.devDependencies?.['@playwright/test'] || '1.60.0';
    return String(raw).replace(/^[\^~]/, '');
  } catch {
    return '1.60.0';
  }
}

async function pinPlaywrightVersion(projectDir: string, onLog?: (msg: string) => void): Promise<void> {
  const version = pinnedPlaywrightVersion();
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies['@playwright/test'] = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  await runCommand(
    'npm',
    ['install'],
    projectDir,
    { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD || '0' },
    onLog
  );
}

function patchWorkspace(projectDir: string, baseUrl: string, projectName: string): void {
  fs.writeFileSync(path.join(projectDir, '.env'), `BASE_URL=${baseUrl}\n`);

  const configPath = path.join(projectDir, 'playwright.config.ts');
  let config = fs.readFileSync(configPath, 'utf8');
  if (!config.includes('baseURL:')) {
    config = config.replace(
      'use: {',
      `use: {\n    baseURL: process.env.BASE_URL || ${JSON.stringify(baseUrl)},`
    );
  }
  fs.writeFileSync(configPath, config);

  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });

  const stamp = `\n\n---\nSTL Automation Platform · ${projectName}\nBase URL: ${baseUrl}\n`;
  const readmePath = path.join(projectDir, 'README.md');
  if (fs.existsSync(readmePath)) {
    fs.appendFileSync(readmePath, stamp);
  }
}

/** Mandatory `npm init playwright@latest` for each UI project workspace */
export async function initPlaywrightProject(
  projectId: string,
  options: { baseUrl: string; name: string; onLog?: (msg: string) => void }
): Promise<string> {
  const projectDir = getProjectWorkspacePath(projectId);
  const log = (msg: string) => (options.onLog ? options.onLog(msg) : console.log(msg));

  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
  fs.mkdirSync(projectDir, { recursive: true });

  const skipBrowsers = process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1';
  const initArgs = [
    'init',
    'playwright@latest',
    '--',
    '--quiet',
    '--browser=chromium',
    '--no-examples',
    '--lang=ts',
    ...(skipBrowsers ? ['--no-browsers'] : ['--install-deps']),
  ];

  log('[SYS] Running npm init playwright@latest (UI project setup)...\n');

  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright';
  const initEnv: NodeJS.ProcessEnv = {
    PLAYWRIGHT_BROWSERS_PATH: browsersPath,
  };
  if (skipBrowsers) {
    initEnv.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';
  }

  await runCommand('npm', initArgs, projectDir, initEnv, log);

  log('[SYS] Aligning @playwright/test version with platform...\n');
  await pinPlaywrightVersion(projectDir, log);

  if (skipBrowsers && fs.existsSync(browsersPath)) {
    log('[SYS] Using shared Chromium from Playwright Docker image...\n');
    await runCommand(
      'npx',
      ['playwright', 'install', 'chromium'],
      projectDir,
      { PLAYWRIGHT_BROWSERS_PATH: browsersPath, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' },
      log
    ).catch(() => log('[SYS] Shared browser path in use (no per-project download)\n'));
  }

  patchWorkspace(projectDir, options.baseUrl, options.name);

  if (!isPlaywrightProjectInitialized(projectId)) {
    throw new Error('playwright.config.ts missing after init');
  }

  log(`[SYS] Playwright project ready: ${projectDir}\n`);
  return projectDir;
}

export function removeProjectWorkspace(projectId: string): void {
  const dir = getProjectWorkspacePath(projectId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
