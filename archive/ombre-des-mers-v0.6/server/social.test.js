import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startGame } from './index.js';

const open = (port) => new Promise((res, rej) => {
  const ws = new WebSocket('ws://127.0.0.1:' + port);
  ws.msgs = [];
  ws.onmessage = (e) => ws.msgs.push(JSON.parse(e.data));
  ws.onopen = () => res(ws); ws.onerror = rej;
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const last = (ws, t) => ws.msgs.filter((m) => m.t === t).pop();

test('comptes, persistance, guildes, alliances, chat', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'edm-')), 'db.json');
  let g = await startGame({ port: 0, tickMs: 20, dataFile: file, autosaveMs: 0 });
  const a = await open(g.port), b = await open(g.port), c = await open(g.port);
  // inscription : validations
  a.send(J({ t: 'auth', mode: 'register', name: 'x', pass: 'secret1' })); await wait(120);
  assert.equal(last(a, 'authres').ok, false);
  a.send(J({ t: 'auth', mode: 'register', name: 'Amiral', pass: 'court' })); await wait(120);
  assert.equal(last(a, 'authres').ok, false);
  a.send(J({ t: 'auth', mode: 'register', name: 'Amiral', pass: 'secret1' })); await wait(250);
  assert.equal(last(a, 'authres').ok, true);
  b.send(J({ t: 'auth', mode: 'register', name: 'Corsaire', pass: 'secret2' })); await wait(250);
  c.send(J({ t: 'auth', mode: 'register', name: 'Pirate', pass: 'secret3' })); await wait(250);
  // mot de passe jamais en clair sur disque
  g.stop(); const raw = fs.readFileSync(file, 'utf8');
  assert.ok(!raw.includes('secret1') && raw.includes('"hash"'));
  g = await startGame({ port: 0, tickMs: 20, dataFile: file, autosaveMs: 0 });
  const A = await open(g.port), B = await open(g.port), C = await open(g.port);
  A.send(J({ t: 'auth', mode: 'login', name: 'Amiral', pass: 'mauvais' })); await wait(250);
  assert.equal(last(A, 'authres').ok, false);
  A.send(J({ t: 'auth', mode: 'login', name: 'Amiral', pass: 'secret1' })); await wait(250);
  assert.equal(last(A, 'authres').ok, true);
  B.send(J({ t: 'auth', mode: 'login', name: 'Corsaire', pass: 'secret2' })); await wait(250);
  C.send(J({ t: 'auth', mode: 'login', name: 'Pirate', pass: 'secret3' })); await wait(250);
  const dup = await open(g.port);
  dup.send(J({ t: 'auth', mode: 'login', name: 'Amiral', pass: 'secret1' })); await wait(250);
  assert.equal(last(dup, 'authres').ok, false, 'double connexion refusée');
  // or → fonder guildes
  for (const p of g.world.players.values()) p.gold = 5000;
  A.send(J({ t: 'chat', text: '/guilde creer Marine MAR' })); await wait(900);
  B.send(J({ t: 'chat', text: '/guilde creer Corsaires COR' })); await wait(100);
  assert.equal(g.world.guilds.size, 2);
  A.send(J({ t: 'chat', text: '/guilde inviter Pirate' })); await wait(100);
  C.send(J({ t: 'chat', text: '/guilde accepter' })); await wait(100);
  const pirate = [...g.world.players.values()].find((p) => p.name === 'Pirate');
  assert.equal(pirate.guild, 'Marine');
  // alliance mutuelle
  await wait(800); A.send(J({ t: 'chat', text: '/guilde alliance Corsaires' })); await wait(850);
  B.send(J({ t: 'chat', text: '/guilde alliance Marine' })); await wait(100);
  assert.ok(g.world.guilds.get('marine').allies.has('corsaires'));
  // guerre puis alliance rompue
  A.send(J({ t: 'chat', text: '/guilde guerre Corsaires' })); await wait(850);
  assert.ok(g.world.guilds.get('marine').wars.has('corsaires') && !g.world.guilds.get('marine').allies.has('corsaires'));
  // chat global et de guilde
  C.send(J({ t: 'chat', text: 'Bonjour <b>tous</b>' })); await wait(100);
  assert.ok(B.msgs.some((m) => m.t === 'chat' && m.text === 'Bonjour btous/b' && m.scope === 'global'));
  await wait(850); A.send(J({ t: 'chat', scope: 'guild', text: 'secret de guilde' })); await wait(100);
  assert.ok(C.msgs.some((m) => m.text === 'secret de guilde'));
  assert.ok(!B.msgs.some((m) => m.text === 'secret de guilde'), 'chat de guilde privé');
  // progression sauvegardée
  const am = [...g.world.players.values()].find((p) => p.name === 'Amiral'); am.gold = 777; am.up.hull = 3;
  A.close(); await wait(100); g.stop();
  g = await startGame({ port: 0, tickMs: 20, dataFile: file, autosaveMs: 0 });
  const A2 = await open(g.port);
  A2.send(J({ t: 'auth', mode: 'login', name: 'Amiral', pass: 'secret1' })); await wait(250);
  const back = [...g.world.players.values()].find((p) => p.name === 'Amiral');
  assert.equal(back.gold, 777);
  assert.equal(back.up.hull, 3);
  assert.equal(back.guild, 'Marine', 'guilde restaurée');
  A2.close(); g.stop();
});

test('invités : pas de guilde, pas d\'usurpation de pseudo de compte', async () => {
  const g = await startGame({ port: 0, tickMs: 20, autosaveMs: 0 });
  const a = await open(g.port);
  a.send(J({ t: 'join', name: 'Amiral' })); await wait(100);
  a.send(J({ t: 'chat', text: '/guilde creer Faux FAU' })); await wait(100);
  assert.equal(g.world.guilds.size, 0);
  assert.equal([...g.world.players.values()][0].name, 'Invité Amiral');
  a.close(); g.stop();
});
