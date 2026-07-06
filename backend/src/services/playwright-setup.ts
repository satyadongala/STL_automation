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
    const args = fs.existsSync(cli)
      ? [cli, 'install', 'chromium']
      : ['playwright', 'install', 'chromium'];

    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' },
    });

    child.stdout.on('data', (d) => log(d.toString()));
    child.stderr.on('data', (d) => log(d.toString()));

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        log('[SYS] Playwright Chromium is ready.\n');
        resolve();
      } else {
        reject(new Error(`playwright install exited with code ${code}`));
      }
    });
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
