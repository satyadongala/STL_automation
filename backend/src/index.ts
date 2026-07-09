import * as dotenv from 'dotenv';
import * as http from 'http';
import app from './server';
import { wsManager } from './ws';
import { ensurePlaywrightBrowsersBackground } from './services/playwright-setup';
import { handleVncUpgrade } from './vnc-proxy';

dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/data/dev.db';
}

const port = Number(process.env.PORT) || 5001;

const server = http.createServer(app);

wsManager.init();

server.on('upgrade', (req, socket, head) => {
  if (handleVncUpgrade(req, socket, head)) return;

  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  if (url.searchParams.has('runId')) {
    wsManager.handleUpgrade(req, socket, head);
    return;
  }

  socket.destroy();
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[SYS] Server running on http://localhost:${port}`);
  console.log(`[SYS] WebSocket server is active on the same port ws://localhost:${port}`);
  ensurePlaywrightBrowsersBackground((msg) => process.stdout.write(msg));
});
