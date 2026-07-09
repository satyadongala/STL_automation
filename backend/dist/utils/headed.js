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
exports.ensureVirtualDisplay = ensureVirtualDisplay;
exports.resolveHeaded = resolveHeaded;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
let displayReady = null;
let xvfbProcess = null;
/** Linux/Docker needs Xvfb for headed Chromium when no physical display exists. */
async function ensureVirtualDisplay(onLog) {
    if (process.platform !== 'linux')
        return;
    if (process.env.DISPLAY)
        return;
    if (!displayReady) {
        displayReady = startXvfb(onLog).catch((err) => {
            displayReady = null;
            throw err;
        });
    }
    await displayReady;
}
function startXvfb(onLog) {
    const log = (msg) => (onLog ? onLog(msg) : console.log(msg));
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
        xvfbProcess = (0, child_process_1.spawn)('Xvfb', [
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
function resolveHeaded(requested) {
    return requested === true;
}
