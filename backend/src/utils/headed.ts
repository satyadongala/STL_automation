import { spawn } from 'child_process';
import * as fs from 'fs';

let displayReady: Promise<void> | null = null;
let xvfbProcess: ReturnType<typeof spawn> | null = null;

/** Linux/Docker needs Xvfb for headed Chromium when no physical display exists. */
export async function ensureVirtualDisplay(onLog?: (msg: string) => void): Promise<void> {
  if (process.platform !== 'linux') return;
  if (process.env.DISPLAY) return;

  if (!displayReady) {
    displayReady = startXvfb(onLog).catch((err) => {
      displayReady = null;
      throw err;
    });
  }
  await displayReady;
}

function startXvfb(onLog?: (msg: string) => void): Promise<void> {
  const log = (msg: string) => (onLog ? onLog(msg) : console.log(msg));

  return new Promise((resolve, reject) => {
    const display = process.env.XVFB_DISPLAY || ':99';
    const lock = `/tmp/.X${display.replace(':', '')}-lock`;
    if (fs.existsSync(lock)) {
      process.env.DISPLAY = display;
      log(`[SYS] Using existing virtual display ${display}\n`);
      resolve();
      return;
    }

    log(`[SYS] Starting virtual display (Xvfb ${display}) for headed UI tests...\n`);

    xvfbProcess = spawn('Xvfb', [
      display,
      '-screen', '0', '1920x1080x24',
      '-ac',
      '+extension', 'GLX',
      '+render',
      '-noreset',
    ], { detached: false, stdio: 'ignore' });

    xvfbProcess.on('error', (err) => {
      reject(new Error(`Xvfb not available (install xvfb in Docker image): ${err.message}`));
    });

    // ponytail: naive wait — good enough for container boot
    setTimeout(() => {
      if (xvfbProcess?.exitCode != null) {
        reject(new Error(`Xvfb exited with code ${xvfbProcess.exitCode}`));
        return;
      }
      process.env.DISPLAY = display;
      log(`[SYS] Virtual display ready (DISPLAY=${display})\n`);
      resolve();
    }, 800);
  });
}

export function resolveHeaded(requested?: boolean): boolean {
  return requested === true;
}
