import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

let setupPromise: Promise<void> | null = null;

function browserInstalled(): boolean {
  try {
    return fs.existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

function runInstall(onLog?: (msg: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const log = (msg: string) => {
      if (onLog) onLog(msg);
      else console.log(msg);
    };

    log('[SYS] Installing Playwright Chromium browser (one-time setup)...\n');

    const cli = path.join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
    const cmd = fs.existsSync(cli) ? process.execPath : 'npx';
    const installDepsArgs = fs.existsSync(cli)
      ? [cli, 'install-deps', 'chromium']
      : ['playwright', 'install-deps', 'chromium'];
    const installArgs = fs.existsSync(cli)
      ? [cli, 'install', 'chromium']
      : ['playwright', 'install', 'chromium'];

    const child = spawn(cmd, installDepsArgs, {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' },
    });

    child.on('close', (depsCode) => {
      if (depsCode !== 0) {
        log('[SYS] install-deps skipped or unavailable (ok on official Playwright Docker image)\n');
      }
      const install = spawn(cmd, installArgs, {
        cwd: process.cwd(),
        env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' },
      });
      install.stdout.on('data', (d) => log(d.toString()));
      install.stderr.on('data', (d) => log(d.toString()));
      install.on('error', reject);
      install.on('close', (code) => {
        if (code === 0) {
          log('[SYS] Playwright Chromium is ready.\n');
          resolve();
        } else {
          reject(new Error(`playwright install exited with code ${code}`));
        }
      });
    });

    child.stdout.on('data', (d) => log(d.toString()));
    child.stderr.on('data', (d) => log(d.toString()));
    child.on('error', reject);
  });
}

/** ponytail: single-flight install; chromium only (UI + request fixtures) */
export async function ensurePlaywrightBrowsers(onLog?: (msg: string) => void): Promise<void> {
  if (browserInstalled()) return;

  if (!setupPromise) {
    setupPromise = runInstall(onLog).catch((err) => {
      setupPromise = null;
      throw err;
    });
  }

  await setupPromise;
}

export function ensurePlaywrightBrowsersBackground(onLog?: (msg: string) => void): void {
  if (browserInstalled()) return;
  void ensurePlaywrightBrowsers(onLog).catch((err) => {
    const msg = `[SYS] Playwright setup failed: ${err.message}`;
    if (onLog) onLog(msg + '\n');
    else console.warn(msg);
  });
}
