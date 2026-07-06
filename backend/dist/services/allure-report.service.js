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
exports.generateAllureReport = generateAllureReport;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
function generateAllureReport(resultsDir, outputDir, onLog) {
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
        const child = (0, child_process_1.spawn)('npx', ['allure', 'generate', resultsDir, '-o', outputDir, '--clean'], { env: { ...process.env, NO_COLOR: '1' } });
        let stderr = '';
        child.stderr.on('data', (d) => {
            stderr += d.toString();
        });
        child.on('close', (code) => {
            if (code === 0) {
                if (onLog)
                    onLog(`[SYS] Allure report ready at reports/allure/${pathBasename(outputDir)}/index.html\n`);
                resolve(true);
            }
            else {
                if (onLog)
                    onLog(`[SYS] Allure report generation skipped (${stderr.trim() || `exit ${code}`})\n`);
                resolve(false);
            }
        });
        child.on('error', () => resolve(false));
    });
}
function pathBasename(p) {
    return p.split(/[/\\]/).filter(Boolean).pop() || '';
}
