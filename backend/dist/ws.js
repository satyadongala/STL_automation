"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = void 0;
const ws_1 = require("ws");
const MAX_BUFFER_CHARS = 500_000;
class WebSocketManager {
    wss = null;
    clients = new Map();
    logBuffers = new Map();
    statusBuffers = new Map();
    init() {
        this.wss = new ws_1.WebSocketServer({ noServer: true });
        this.wss.on('connection', (ws, req) => {
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
            const runId = url.searchParams.get('runId');
            if (!runId) {
                ws.close(4000, 'runId is required');
                return;
            }
            if (!this.clients.has(runId)) {
                this.clients.set(runId, new Set());
            }
            this.clients.get(runId).add(ws);
            // Replay buffered logs/status so late-connecting clients still see output
            const bufferedLogs = this.logBuffers.get(runId);
            if (bufferedLogs) {
                ws.send(JSON.stringify({ type: 'LOG', data: bufferedLogs }));
            }
            const bufferedStatus = this.statusBuffers.get(runId);
            if (bufferedStatus) {
                ws.send(JSON.stringify({ type: 'STATUS', data: bufferedStatus }));
            }
            ws.on('close', () => {
                const runClients = this.clients.get(runId);
                if (runClients) {
                    runClients.delete(ws);
                    if (runClients.size === 0) {
                        this.clients.delete(runId);
                    }
                }
            });
        });
    }
    handleUpgrade(req, socket, head) {
        if (!this.wss)
            return;
        this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit('connection', ws, req);
        });
    }
    appendLogBuffer(runId, log) {
        const prev = this.logBuffers.get(runId) || '';
        const next = prev + log;
        this.logBuffers.set(runId, next.length > MAX_BUFFER_CHARS ? next.slice(-MAX_BUFFER_CHARS) : next);
    }
    clearRun(runId) {
        this.logBuffers.delete(runId);
        this.statusBuffers.delete(runId);
        this.clients.delete(runId);
    }
    streamLog(runId, log) {
        const clean = log.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
        this.appendLogBuffer(runId, clean);
        const runClients = this.clients.get(runId);
        if (!runClients)
            return;
        const message = JSON.stringify({ type: 'LOG', data: clean });
        runClients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    streamStatus(runId, status) {
        this.statusBuffers.set(runId, status);
        const runClients = this.clients.get(runId);
        if (!runClients)
            return;
        const message = JSON.stringify({ type: 'STATUS', data: status });
        runClients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    streamSpan(runId, payload) {
        const runClients = this.clients.get(runId);
        if (!runClients)
            return;
        const message = JSON.stringify({ type: 'SPAN', data: payload });
        runClients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}
exports.wsManager = new WebSocketManager();
