"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = void 0;
const ws_1 = require("ws");
class WebSocketManager {
    wss = null;
    clients = new Map();
    init(server) {
        this.wss = new ws_1.WebSocketServer({ server });
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
    streamLog(runId, log) {
        const runClients = this.clients.get(runId);
        if (!runClients)
            return;
        const message = JSON.stringify({ type: 'LOG', data: log });
        runClients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    streamStatus(runId, status) {
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
