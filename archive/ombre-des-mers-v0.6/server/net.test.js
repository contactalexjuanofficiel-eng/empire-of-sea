import test from 'node:test';
import assert from 'node:assert/strict';
import { startGame } from './index.js';

const open = (port) => new Promise((res, rej) => {
  const ws = new WebSocket('ws://127.0.0.1:' + port);
  ws.msgs = [];
  ws.onmessage = (e) => ws.msgs.push(JSON.parse(e.data));
  ws.onopen = () => res(ws);
  ws.onerror = rej;
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('deux joueurs se connectent, se voient et le tir est autoritaire', async () => {
  const g = await startGame({ port: 0, tickMs: 20 });
  const a = await open(g.port), b = await open(g.port);
  a.send(JSON.stringify({ t: 'join', name: 'Alice' }));
  b.send(JSON.stringify({ t: 'join', name: '<b>Bob</b>' }));
  await wait(200);
  assert.ok(a.msgs.some((m) => m.t === 'welcome'));
  const snap = a.msgs.filter((m) => m.t === 'snap').pop();
  assert.ok(snap, 'snapshot reçu');
  const names = snap.players.map((p) => p.name);
  assert.deepEqual(names.sort(), ['Invité Alice', 'Invité bBob/b']);
  assert.equal(snap.players.length, 2);
  // entrées hostiles ignorées sans planter
  a.send('pas du json'); a.send(JSON.stringify({ t: 'input', thr: 1e9, rudder: NaN }));
  a.send(JSON.stringify({ t: 'fire', side: 1 }));
  await wait(150);
  assert.ok(a.readyState === 1);
  a.close(); await wait(100);
  const last = b.msgs.filter((m) => m.t === 'snap').pop();
  assert.ok(!JSON.stringify(last).includes('Invité Alice'), 'joueur déconnecté retiré');
  b.close(); g.stop();
  await wait(50);
});
