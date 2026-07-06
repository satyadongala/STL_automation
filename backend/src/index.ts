import * as dotenv from 'dotenv';
import * as http from 'http';
import app from './server';
import { wsManager } from './ws';
import { ensurePlaywrightBrowsersBackground } from './services/playwright-setup';

dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/data/dev.db';
}

const port = Number(process.env.PORT) || 5001;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSockets
wsManager.init(server);

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`[SYS] Server running on http://localhost:${port}`);
  console.log(`[SYS] WebSocket server is active on the same port ws://localhost:${port}`);
  ensurePlaywrightBrowsersBackground((msg) => process.stdout.write(msg));
});
