import { spawn } from 'child_process';
import * as fs from 'fs';

let displayReady: Promise<string> | null = null;

function displayNum(display: string): string {
  return display.replace(':', '');
}

function lockPath(display: string): string {
  return `/tmp/.X${displayNum(display)}-lock`;
}

function displayIsRunning(display: string): boolean {
  return fs.existsSync(lockPath(display));
}

/** Returns DISPLAY value (e.g. :99) once Xvfb is running on Linux. */
export async function ensureVirtualDisplay(onLog?: (msg: string) => void): Promise<string | null> {
  if (process.platform !== 'linux') return null;

  const display = process.env.XVFB_DISPLAY || ':99';

  if (displayIsRunning(display)) {
    process.env.DISPLAY = display;
    return display;
  }

  if (!displayReady) {
    displayReady = startXvfb(display, onLog).catch((err) => {
      displayReady = null;
      throw err;
    });
  }
  return displayReady;
}

function startXvfb(display: string, onLog?: (msg: string) => void): Promise<string> {
  const log = (msg: string) => (onLog ? onLog(msg) : console.log(msg));

  return new Promise((resolve, reject) => {
    log(`[SYS] Starting virtual display (Xvfb ${display}) for headed UI tests...\n`);

    const xvfb = spawn(
      'Xvfb',
      [display, '-screen', '0', '1920x1080x24', '-ac', '+extension', 'GLX', '+render', '-noreset'],
      { detached: false, stdio: 'ignore' }
    );

    xvfb.on('error', (err) => {
      reject(new Error(`Xvfb not installed in container: ${err.message}`));
    });

    const deadline = Date.now() + 5000;
    const poll = () => {
      if (displayIsRunning(display)) {
        process.env.DISPLAY = display;
        log(`[SYS] Virtual display ready (DISPLAY=${display})\n`);
        resolve(display);
        return;
      }
      if (xvfb.exitCode != null) {
        reject(new Error(`Xvfb exited with code ${xvfb.exitCode}`));
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`Xvfb did not start within 5s (check xvfb package in Docker image)`));
        return;
      }
      setTimeout(poll, 100);
    };
    setTimeout(poll, 200);
  });
}

export function resolveHeaded(requested?: boolean): boolean {
  return requested === true;
}

export function useXvfbRunWrapper(headed: boolean): boolean {
  return headed && process.platform === 'linux';
}
