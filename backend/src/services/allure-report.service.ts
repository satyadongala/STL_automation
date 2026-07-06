import { spawn } from 'child_process';
import * as fs from 'fs';

export function generateAllureReport(
  resultsDir: string,
  outputDir: string,
  onLog?: (msg: string) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!fs.existsSync(resultsDir)) {
      resolve(false);
      return;
    }
    const files = fs.readdirSync(resultsDir);
    if (files.length === 0) {
      resolve(false);
      return;
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const child = spawn(
      'npx',
      ['allure', 'generate', resultsDir, '-o', outputDir, '--clean'],
      { env: { ...process.env, NO_COLOR: '1' } }
    );

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        if (onLog) onLog(`[SYS] Allure report ready at reports/allure/${pathBasename(outputDir)}/index.html\n`);
        resolve(true);
      } else {
        if (onLog) onLog(`[SYS] Allure report generation skipped (${stderr.trim() || `exit ${code}`})\n`);
        resolve(false);
      }
    });

    child.on('error', () => resolve(false));
  });
}

function pathBasename(p: string): string {
  return p.split(/[/\\]/).filter(Boolean).pop() || '';
}
