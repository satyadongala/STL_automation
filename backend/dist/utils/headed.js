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
exports.useXvfbRunWrapper = useXvfbRunWrapper;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
let displayReady = null;
function displayNum(display) {
    return display.replace(':', '');
}
function lockPath(display) {
    return `/tmp/.X${displayNum(display)}-lock`;
}
function displayIsRunning(display) {
    return fs.existsSync(lockPath(display));
}
/** Returns DISPLAY value (e.g. :99) once Xvfb is running on Linux. */
async function ensureVirtualDisplay(onLog) {
    if (process.platform !== 'linux')
        return null;
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
function startXvfb(display, onLog) {
    const log = (msg) => (onLog ? onLog(msg) : console.log(msg));
    return new Promise((resolve, reject) => {
        log(`[SYS] Starting virtual display (Xvfb ${display}) for headed UI tests...\n`);
        const xvfb = (0, child_process_1.spawn)('Xvfb', [display, '-screen', '0', '1920x1080x24', '-ac', '+extension', 'GLX', '+render', '-noreset'], { detached: false, stdio: 'ignore' });
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
function resolveHeaded(requested) {
    return requested === true || requested === 'true' || requested === 1 || requested === '1';
}
/** Only wrap with xvfb-run when no display exists — Docker entrypoint already sets DISPLAY=:99 for noVNC */
function useXvfbRunWrapper(headed) {
    return headed && process.platform === 'linux' && !process.env.DISPLAY;
}
