// Point d'entrée du serveur de jeu : HTTP (client + API) et WebSocket temps réel sur le même port.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { login, register } from './auth.ts';
import { openStore } from './db.ts';
import { Hub } from './Hub.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 8080);
const DB_FILE = process.env.DB_FILE ?? path.join(ROOT, 'data', 'empire.db');
const STATIC = path.join(ROOT, 'dist', 'client');

export function startServer(port = PORT, dbFile = DB_FILE) {
  const store = openStore(dbFile);
  const hub = new Hub(store);
  hub.start();

  const attempts = new Map<string, { n: number; t: number }>();
  const limited = (ip: string) => {
    const now = Date.now();
    const a = attempts.get(ip) ?? { n: 0, t: now };
    if (now - a.t > 60_000) { a.n = 0; a.t = now; }
    a.n++;
    attempts.set(ip, a);
    return a.n > 20;
  };

  const json = (res: http.ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const readBody = (req: http.IncomingMessage) => new Promise<Record<string, unknown>>((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });

  const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const ip = req.socket.remoteAddress ?? '?';
    if (url.pathname === '/api/register' || url.pathname === '/api/login') {
      if (req.method !== 'POST') return json(res, 405, { ok: false });
      if (limited(ip)) return json(res, 429, { ok: false, msg: 'Trop de tentatives, patientez une minute.' });
      const b = await readBody(req);
      const fn = url.pathname === '/api/register' ? register : login;
      return json(res, 200, await fn(store, String(b.name ?? ''), String(b.pass ?? '')));
    }
    if (url.pathname === '/api/classement') return json(res, 200, hub.leaderboard());
    if (url.pathname === '/api/status') return json(res, 200, hub.status());

    // Fichiers du client compilé (npm run build).
    let file = path.normalize(path.join(STATIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(STATIC)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Client non compilé : lancez « npm start » (ou « npm run dev » puis http://localhost:5173).');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
    fs.createReadStream(file).pipe(res);
  });

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (ws) => {
    // Le premier message doit être { t: 'hello', token } ; sinon on coupe.
    const timeout = setTimeout(() => ws.close(1008, 'auth'), 10_000);
    ws.once('message', (data) => {
      clearTimeout(timeout);
      let m: { t?: string; token?: string };
      try { m = JSON.parse(String(data)); } catch { return ws.close(1008, 'auth'); }
      const acc = m.t === 'hello' && typeof m.token === 'string' ? store.sessionAccount(m.token) : null;
      if (!acc) {
        ws.send(JSON.stringify({ t: 'err', text: 'Session expirée, reconnectez-vous.' }));
        return ws.close(1008, 'auth');
      }
      hub.attach(ws, acc);
    });
  });

  server.listen(port, () => {
    console.log(`⚓ EMPIRE OF SEA — serveur prêt sur http://localhost:${port}  (base : ${dbFile})`);
  });

  const shutdown = () => {
    hub.stop();
    for (const c of wss.clients) c.terminate();
    wss.close();
    server.close();
    store.close();
  };
  return { server, hub, store, shutdown };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const s = startServer();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { s.shutdown(); process.exit(0); });
}
