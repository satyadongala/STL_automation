"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensurePlaywrightBrowsers = ensurePlaywrightBrowsers;
exports.ensurePlaywrightBrowsersBackground = ensurePlaywrightBrowsersBackground;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const test_1 = require("@playwright/test");
let setupPromise = null;
function browserInstalled() {
    try {
        return fs.existsSync(test_1.chromium.executablePath());
    }
    catch {
        return false;
    }
}
function runInstall(onLog) {
    return new Promise((resolve, reject) => {
        const log = (msg) => {
            if (onLog)
                onLog(msg);
            else
                console.log(msg);
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
        const child = (0, child_process_1.spawn)(cmd, installDepsArgs, {
            cwd: process.cwd(),
            env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' },
        });
        child.on('close', (depsCode) => {
            if (depsCode !== 0) {
                log('[SYS] install-deps skipped or unavailable (ok on official Playwright Docker image)\n');
            }
            const install = (0, child_process_1.spawn)(cmd, installArgs, {
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
                }
                else {
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
async function ensurePlaywrightBrowsers(onLog) {
    if (browserInstalled())
        return;
    if (!setupPromise) {
        setupPromise = runInstall(onLog).catch((err) => {
            setupPromise = null;
            throw err;
        });
    }
    await setupPromise;
}
function ensurePlaywrightBrowsersBackground(onLog) {
    if (browserInstalled())
        return;
    void ensurePlaywrightBrowsers(onLog).catch((err) => {
        const msg = `[SYS] Playwright setup failed: ${err.message}`;
        if (onLog)
            onLog(msg + '\n');
        else
            console.warn(msg);
    });
}
