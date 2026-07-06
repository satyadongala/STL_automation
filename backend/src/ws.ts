import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';

const MAX_BUFFER_CHARS = 500_000;

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocket>> = new Map();
  private logBuffers: Map<string, string> = new Map();
  private statusBuffers: Map<string, string> = new Map();

  public init(server: http.Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const runId = url.searchParams.get('runId');

      if (!runId) {
        ws.close(4000, 'runId is required');
        return;
      }

      if (!this.clients.has(runId)) {
        this.clients.set(runId, new Set());
      }
      this.clients.get(runId)!.add(ws);

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

  private appendLogBuffer(runId: string, log: string) {
    const prev = this.logBuffers.get(runId) || '';
    const next = prev + log;
    this.logBuffers.set(
      runId,
      next.length > MAX_BUFFER_CHARS ? next.slice(-MAX_BUFFER_CHARS) : next
    );
  }

  public clearRun(runId: string) {
    this.logBuffers.delete(runId);
    this.statusBuffers.delete(runId);
    this.clients.delete(runId);
  }

  public streamLog(runId: string, log: string) {
    const clean = log.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    this.appendLogBuffer(runId, clean);

    const runClients = this.clients.get(runId);
    if (!runClients) return;

    const message = JSON.stringify({ type: 'LOG', data: clean });
    runClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public streamStatus(runId: string, status: string) {
    this.statusBuffers.set(runId, status);

    const runClients = this.clients.get(runId);
    if (!runClients) return;

    const message = JSON.stringify({ type: 'STATUS', data: status });
    runClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public streamSpan(runId: string, payload: unknown) {
    const runClients = this.clients.get(runId);
    if (!runClients) return;

    const message = JSON.stringify({ type: 'SPAN', data: payload });
    runClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

export const wsManager = new WebSocketManager();
