// Serveur de jeu multijoueur — boucle autoritaire à 20 Hz, WebSocket sans dépendance.
// Lancer : `npm start` (port 8080, sauvegarde dans data/players.json).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWsServer } from './ws-lite.js';
import { WORLD } from '../shared/data.js';
import { createWorld, addPlayer, removePlayer, setInput, fire, step, snapshot, buy, PORT, exportPlayer, importPlayer } from './sim.js';
import { createStore } from './accounts.js';
import { guildCommand, loadGuilds, serializeGuilds, validMembership } from './guilds.js';

const TICK = 1 / 20;
const CLIENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client3d');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

// Sert le client 3D (fichiers statiques, sans sortir du dossier) ; '/' redirige vers le mode en ligne.
function serveClient(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' && !u.searchParams.has('ws')) { res.writeHead(302, { Location: '/?ws=' + encodeURIComponent('ws://' + (req.headers.host || 'localhost')) }); return res.end(); }
  const rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname).replace(/^\/+/, '');
  const file = path.resolve(CLIENT_DIR, rel);
  if (!file.startsWith(CLIENT_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Introuvable'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
const MAX_MSGS_PER_SEC = 60;
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

export async function startGame({ port = 8080, tickMs = TICK * 1000, dataFile = null, autosaveMs = 30000 } = {}) {
  const world = createWorld();
  const store = createStore(dataFile);
  loadGuilds(world, store.guilds);
  const sessions = new Map(); // id -> { ws, id, name, account, joined }
  let counter = 1;

  const send = (ws, o) => ws.send(JSON.stringify(o));
  const sayTo = (name, text) => { for (const s of sessions.values()) if (s.name === name && s.joined) send(s.ws, { t: 'sys', text }); };
  const onlineP = (name) => { const l = String(name).toLowerCase(); for (const p of world.players.values()) if (p.name.toLowerCase() === l) return p; return null; };
  const persist = (s) => { const p = world.players.get(s.id); if (s.account && p) store.saveProgress(s.name, exportPlayer(p)); };
  const saveAll = () => { for (const s of sessions.values()) persist(s); store.setGuilds(serializeGuilds(world)); store.flush(); };

  const start = (s, name, save) => {
    const p = addPlayer(world, s.id, name);
    p.account = s.account;
    if (save) { importPlayer(p, save); p.guild = validMembership(world, name, save.guild); }
    s.name = name; s.joined = true;
    send(s.ws, { t: 'welcome', id: s.id, name, islands: world.islands, port: PORT, world: WORLD });
  };

  const srv = await createWsServer({
    port, onHttp: serveClient,
    onConnection(ws) {
      const s = { ws, id: 'p' + counter++, name: null, account: false, joined: false, busy: false, fails: 0, lastChat: 0 };
      sessions.set(s.id, s);
      let windowStart = Date.now(), count = 0;
      ws.on('message', async (raw) => {
        const now = Date.now();
        if (now - windowStart > 1000) { windowStart = now; count = 0; }
        if (++count > MAX_MSGS_PER_SEC) return;
        let m;
        try { m = JSON.parse(raw.toString()); } catch { return; }
        if (!m || typeof m !== 'object') return;
        if (!s.joined) {
          if (s.busy) return;
          if (m.t === 'join') { s.busy = true; start(s, 'Invité ' + (clean(m.name, 14) || 'Capitaine'), null); }
          else if (m.t === 'auth') {
            s.busy = true;
            try {
              const reg = m.mode === 'register';
              const r = reg ? await store.register(m.name, m.pass) : await store.login(m.name, m.pass);
              if (!r.ok) { s.fails++; s.busy = false; send(ws, { t: 'authres', ok: false, msg: r.msg }); if (s.fails >= 5) ws.close(); return; }
              if (onlineP(r.name)) { s.busy = false; return send(ws, { t: 'authres', ok: false, msg: 'Ce compte est déjà connecté' }); }
              s.account = true;
              send(ws, { t: 'authres', ok: true, msg: reg ? 'Compte créé' : 'Connecté' });
              start(s, r.name, reg ? null : r.save);
            } catch { s.busy = false; send(ws, { t: 'authres', ok: false, msg: 'Erreur serveur' }); }
          }
          return;
        }
        if (m.t === 'input') setInput(world, s.id, m);
        else if (m.t === 'fire') fire(world, s.id, m.side < 0 ? -1 : 1);
        else if (m.t === 'buy') send(ws, { t: 'buyres', ...buy(world, s.id, String(m.kind), m.arg) });
        else if (m.t === 'chat') {
          if (now - s.lastChat < 800) return;
          s.lastChat = now;
          const text = clean(m.text, 120);
          if (!text) return;
          const p = world.players.get(s.id);
          if (text.startsWith('/guilde')) {
            if (!s.account) return send(ws, { t: 'sys', text: 'Il faut un compte pour les guildes.' });
            return guildCommand(world, p, text.split(/\s+/).slice(1), { say: sayTo, online: onlineP });
          }
          const guildOnly = m.scope === 'guild';
          if (guildOnly && !p.guild) return send(ws, { t: 'sys', text: 'Vous n\'avez pas de guilde.' });
          const msg = { t: 'chat', from: s.name, scope: guildOnly ? 'guild' : 'global', text };
          for (const o of sessions.values()) {
            if (!o.joined) continue;
            const q = world.players.get(o.id);
            if (!guildOnly || (q && q.guild && q.guild === p.guild)) send(o.ws, msg);
          }
        }
      });
      ws.on('close', () => { persist(s); removePlayer(world, s.id); sessions.delete(s.id); store.setGuilds(serializeGuilds(world)); store.flush(); });
    },
  });
  const timer = setInterval(() => {
    step(world, TICK);
    const msg = JSON.stringify({ ...snapshot(world), t: 'snap' });
    for (const c of srv.clients) c.send(msg);
  }, tickMs);
  const saver = autosaveMs ? setInterval(saveAll, autosaveMs) : null;
  return { world, store, port: srv.port, stop() { clearInterval(timer); if (saver) clearInterval(saver); saveAll(); srv.close(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = await startGame({ port: Number(process.env.PORT) || 8080, dataFile: process.env.DATA_FILE || 'data/players.json' });
  console.log(`Serveur Empire des Mers sur ws://localhost:${g.port}`);
  const bye = () => { g.stop(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
