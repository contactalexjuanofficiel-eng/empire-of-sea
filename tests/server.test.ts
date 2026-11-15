// Tests d'intégration : vrai serveur HTTP + WebSocket, deux joueurs simultanés.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import type { S2C } from '../shared/protocol.ts';
import { startServer } from '../server/index.ts';

const PORT = 18000 + Math.floor(Math.random() * 1000);
let srv: ReturnType<typeof startServer>;

before(() => { srv = startServer(PORT, ':memory:'); });
after(() => srv.shutdown());

async function api(path: string, body: unknown) {
  const r = await fetch(`http://localhost:${PORT}${path}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  return r.json() as Promise<{ ok: boolean; token?: string; msg?: string }>;
}

class Client {
  ws!: WebSocket;
  msgs: S2C[] = [];
  async connect(token: string) {
    this.ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    await new Promise((r) => this.ws.once('open', r));
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(String(d))));
    this.send({ t: 'hello', token, v: 1 });
  }
  send(m: unknown) { this.ws.send(JSON.stringify(m)); }
  async wait<T extends S2C['t']>(t: T, pred: (m: Extract<S2C, { t: T }>) => boolean = () => true, ms = 4000): Promise<Extract<S2C, { t: T }>> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = this.msgs.find((x) => x.t === t && pred(x as Extract<S2C, { t: T }>));
      if (m) return m as Extract<S2C, { t: T }>;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`message ${t} non reçu`);
  }
}

test('comptes : inscription, refus des doublons et des mauvais mots de passe', async () => {
  const a = await api('/api/register', { name: 'Surcouf', pass: 'corsaire1' });
  assert.equal(a.ok, true);
  assert.equal((await api('/api/register', { name: 'surcouf', pass: 'autre123' })).ok, false);
  assert.equal((await api('/api/login', { name: 'Surcouf', pass: 'mauvais' })).ok, false);
  assert.equal((await api('/api/login', { name: 'Surcouf', pass: 'corsaire1' })).ok, true);
  assert.equal((await api('/api/register', { name: '<script>', pass: 'corsaire1' })).ok, false);
});

test('multijoueur : deux capitaines se voient en mer, tirent et le serveur arbitre', async () => {
  const ta = (await api('/api/register', { name: 'Tourville', pass: 'amiral01' })).token!;
  const tb = (await api('/api/register', { name: 'JeanBart', pass: 'amiral02' })).token!;
  const A = new Client(), B = new Client();
  await A.connect(ta);
  await B.connect(tb);
  await A.wait('need_create');
  A.send({ t: 'create', portrait: 1, flag: 'royal', ship: 'bayonnaise' });
  B.send({ t: 'create', portrait: 2, flag: 'tricolore', ship: 'mutine' });
  const wa = await A.wait('welcome');
  const wb = await B.wait('welcome');
  assert.equal(wa.profile.ships[0].def, 'bayonnaise');
  A.send({ t: 'undock' });
  B.send({ t: 'undock' });
  // A voit le navire de B avec sa fiche (nom, type de navire, faction).
  const meta = await A.wait('meta', (m) => m.list.some((e) => e.id === wb.id));
  const bm = meta.list.find((e) => e.id === wb.id)!;
  assert.equal(bm.name, 'JeanBart');
  assert.equal(bm.kind, 'player');
  // A avance : le serveur fait bouger son navire.
  A.send({ t: 'input', sail: 3, rudder: 0, seq: 1 });
  const s1 = await A.wait('snap', (m) => m.e.some((e) => e[0] === wa.id));
  const x1 = s1.e.find((e) => e[0] === wa.id)!;
  await new Promise((r) => setTimeout(r, 1500));
  const s2 = A.msgs.filter((m) => m.t === 'snap').at(-1) as Extract<S2C, { t: 'snap' }>;
  const x2 = s2.e.find((e) => e[0] === wa.id)!;
  assert.ok(Math.hypot(x2[1] - x1[1], x2[2] - x1[2]) > 3, 'le navire doit avancer');
  // Tir : l'événement de bordée est diffusé, puis le rechargement interdit un second tir immédiat.
  A.send({ t: 'fire', side: 'babord', x: x2[1] + 200, z: x2[2] });
  const shot = await A.wait('snap', (m) => m.ev.some((e) => e.k === 'shot' && e.id === wa.id));
  assert.ok(shot.me.reload[0] > 0);
  const shotsBefore = A.msgs.filter((m) => m.t === 'snap' && m.ev.some((e) => e.k === 'shot' && e.id === wa.id)).length;
  A.send({ t: 'fire', side: 'babord', x: 0, z: 0 });
  await new Promise((r) => setTimeout(r, 300));
  const shotsAfter = A.msgs.filter((m) => m.t === 'snap' && m.ev.some((e) => e.k === 'shot' && e.id === wa.id)).length;
  assert.equal(shotsAfter, shotsBefore, 'pas de tir pendant le rechargement');
  // Le chat de zone arrive chez l'autre joueur.
  A.send({ t: 'chat', ch: 'zone', text: 'Bon vent, Jean !' });
  const c = await B.wait('chat', (m) => m.from === 'Tourville');
  assert.equal(c.text, 'Bon vent, Jean !');
  // Les messages invalides sont ignorés sans faire tomber le serveur.
  A.ws.send('{pas du json');
  A.send({ t: 'input', sail: 999, rudder: 'x', seq: -5 });
  A.send({ t: 'shop', a: 'buyShip', ship: 'soleil_royal' });
  const e = await A.wait('err');
  assert.match(e.text, /amarré/);
  A.ws.close();
  B.ws.close();
});

test('le classement liste les capitaines', async () => {
  const r = await fetch(`http://localhost:${PORT}/api/classement`);
  const list = await r.json() as { name: string }[];
  assert.ok(Array.isArray(list));
});
