import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import { Duplex } from 'stream';

export const NOVNC_DIR = '/usr/share/novnc';
const WEBSOCKIFY_PORT = Number(process.env.WEBSOCKIFY_PORT) || 6080;

export function isLiveBrowserAvailable(): boolean {
  return process.env.VNC_ENABLED !== '0' && fs.existsSync(NOVNC_DIR);
}

/** TCP proxy for noVNC websocket → local websockify (no extra npm dep) */
export function handleVncUpgrade(
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer
): boolean {
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
  if (pathname !== '/websockify' && pathname !== '/live-browser/websockify') return false;

  const backend = net.connect(WEBSOCKIFY_PORT, '127.0.0.1', () => {
    const headers = { ...req.headers, host: `127.0.0.1:${WEBSOCKIFY_PORT}` };
    let raw = 'GET / HTTP/1.1\r\n';
    for (const [k, v] of Object.entries(headers)) {
      if (v) raw += `${k}: ${Array.isArray(v) ? v.join(', ') : v}\r\n`;
    }
    raw += '\r\n';
    backend.write(raw);
    if (head.length) backend.write(head);
    socket.pipe(backend);
    backend.pipe(socket);
  });

  backend.on('error', () => socket.destroy());
  socket.on('error', () => backend.destroy());
  return true;
}
