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
exports.NOVNC_DIR = void 0;
exports.isLiveBrowserAvailable = isLiveBrowserAvailable;
exports.handleVncUpgrade = handleVncUpgrade;
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
exports.NOVNC_DIR = '/usr/share/novnc';
const WEBSOCKIFY_PORT = Number(process.env.WEBSOCKIFY_PORT) || 6080;
function isLiveBrowserAvailable() {
    return process.env.VNC_ENABLED !== '0' && fs.existsSync(exports.NOVNC_DIR);
}
/** TCP proxy for noVNC websocket → local websockify (no extra npm dep) */
function handleVncUpgrade(req, socket, head) {
    const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    if (pathname !== '/websockify' && pathname !== '/live-browser/websockify')
        return false;
    const backend = net.connect(WEBSOCKIFY_PORT, '127.0.0.1', () => {
        const headers = { ...req.headers, host: `127.0.0.1:${WEBSOCKIFY_PORT}` };
        let raw = 'GET / HTTP/1.1\r\n';
        for (const [k, v] of Object.entries(headers)) {
            if (v)
                raw += `${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`;
        }
        raw += '\r\n';
        backend.write(raw);
        if (head.length)
            backend.write(head);
        socket.pipe(backend);
        backend.pipe(socket);
    });
    backend.on('error', () => socket.destroy());
    socket.on('error', () => backend.destroy());
    return true;
}
