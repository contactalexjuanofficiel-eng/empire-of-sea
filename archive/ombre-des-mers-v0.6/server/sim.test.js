import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, setInput, fire, step, snapshot, statsOf } from './sim.js';
import { ENEMY_TYPES } from '../shared/data.js';

// Monde de test sans apparition automatique d'ennemis.
function quietWorld() {
  const w = createWorld(1);
  w.spawnT = 1e9;
  return w;
}

test('le monde est déterministe (même graine, mêmes îles)', () => {
  const a = createWorld(42), b = createWorld(42);
  assert.deepEqual(a.islands, b.islands);
  assert.ok(a.islands.length >= 10);
});

test('un navire pleine voile avance dans sa direction', () => {
  const w = quietWorld();
  const p = addPlayer(w, 'a', 'Test');
  p.a = 0; // vers l'est
  setInput(w, 'a', { steer: 0, throttle: 1 });
  const x0 = p.x;
  for (let i = 0; i < 100; i++) step(w, 0.02);
  assert.ok(p.x > x0 + 100, 'le navire doit avoir avancé vers l’est');
  assert.ok(Math.abs(p.y - 2000) < 1);
});

test('les entrées invalides sont bornées', () => {
  const w = quietWorld();
  const p = addPlayer(w, 'a');
  setInput(w, 'a', { steer: 999, throttle: -5 });
  assert.equal(p.input.steer, 1);
  assert.equal(p.input.throttle, 0);
  setInput(w, 'a', { steer: 'abc', throttle: NaN });
  assert.equal(p.input.steer, 0);
  assert.equal(p.input.throttle, 0.3);
});

test('un navire ne traverse pas une île', () => {
  const w = quietWorld();
  const p = addPlayer(w, 'a');
  const isl = w.islands[0];
  p.x = isl.x; p.y = isl.y;
  step(w, 0.02);
  const d = Math.hypot(p.x - isl.x, p.y - isl.y);
  assert.ok(d >= isl.r + p.r - 0.01);
});

test('la salve de tribord touche un ennemi sur le côté', () => {
  const w = quietWorld();
  const p = addPlayer(w, 'a');
  p.a = 0; p.x = 1000; p.y = 1000;            // cap est : le tribord vise le sud (+y)
  // On évite toute île sur la trajectoire.
  w.islands.length = 0;
  w.enemies.push({ id: 99, ti: 0, name: 'Cible', lv: 1, x: 1000, y: 1150, a: 0, v: 0, hp: 60, max: 60, dmg: 0, cd: 1e9, slow: 0 });
  assert.equal(fire(w, 'a', 1), true);
  for (let i = 0; i < 50; i++) step(w, 0.02);
  assert.ok(w.enemies.length === 0 || w.enemies[0].hp < 60, 'l’ennemi doit avoir subi des dégâts');
});

test('couler un ennemi rapporte de l’or et de l’XP', () => {
  const w = quietWorld();
  const p = addPlayer(w, 'a');
  p.a = 0; p.x = 1000; p.y = 1000;
  w.islands.length = 0;
  w.enemies.push({ id: 99, ti: 0, name: 'Cible', lv: 1, x: 1000, y: 1150, a: 0, v: 0, hp: 1, max: 1, dmg: 0, cd: 1e9, slow: 0 });
  fire(w, 'a', 1);
  for (let i = 0; i < 50; i++) step(w, 0.02);
  assert.equal(w.enemies.length, 0);
  assert.ok(p.gold >= ENEMY_TYPES[0].gold * 0.8);
  assert.ok(p.xp > 0 || p.level > 1);
  assert.equal(p.sunk, 1);
});

test('le rechargement empêche de tirer deux fois de suite', () => {
  const w = quietWorld();
  addPlayer(w, 'a');
  assert.equal(fire(w, 'a', -1), true);
  assert.equal(fire(w, 'a', -1), false);
  assert.equal(fire(w, 'a', 1), true); // l'autre bord est prêt
});

test('l’instantané est sérialisable et compact', () => {
  const w = quietWorld();
  addPlayer(w, 'a', 'Test');
  const s = JSON.parse(JSON.stringify(snapshot(w)));
  assert.equal(s.players[0].maxHp, statsOf(w.players.get('a')).maxHp);
  assert.ok(JSON.stringify(s).length < 2000);
});

import { buy, PORT } from './sim.js';

test('combat entre joueurs : dégâts hors du port, immunité au port, prime au tueur', () => {
  const w = createWorld(7);
  const a = addPlayer(w, 'a', 'A'), b = addPlayer(w, 'b', 'B');
  a.x = 1000; a.y = 1000; a.a = 0; b.x = 1000 + 230; b.y = 1000 + 0; // B hors port, devant A
  b.gold = 400; b.hp = 5;
  w.balls.push({ id: 99, x: b.x - 10, y: b.y, vx: 500, vy: 0, life: 1, dmg: 50, team: 'p', type: 'ball', owner: 'a' });
  step(w, 0.05);
  assert.ok(w.events.some((e) => e.k === 'pvp' && e.id === 'a'), 'prime PvP');
  assert.ok(a.gold > 0 && b.gold === 280);
  // immunité au port
  const c = addPlayer(w, 'c', 'C'); c.x = PORT.x; c.y = PORT.y; c.hp = 100;
  w.balls.push({ id: 100, x: c.x - 5, y: c.y, vx: 500, vy: 0, life: 1, dmg: 50, team: 'p', type: 'ball', owner: 'a' });
  step(w, 0.01);
  assert.ok(c.hp >= 100);
});

test('boutique : seulement au port, validations strictes', () => {
  const w = createWorld(8);
  const p = addPlayer(w, 'p', 'P'); p.gold = 1000;
  p.x = 100; p.y = 100;
  assert.equal(buy(w, 'p', 'upgrade', 'hull').ok, false);
  p.x = PORT.x; p.y = PORT.y;
  assert.equal(buy(w, 'p', 'upgrade', 'hull').ok, true);
  assert.equal(p.up.hull, 1);
  assert.equal(buy(w, 'p', 'upgrade', '__proto__').ok, false);
  assert.equal(buy(w, 'p', 'ship', 3).ok, false, 'élite insuffisante');
  p.elite = 200;
  assert.equal(buy(w, 'p', 'ship', 1).ok, true);
  assert.equal(p.ship, 1);
  assert.equal(buy(w, 'p', 'ship', 0).ok, false, 'pas de rétrogradation');
  p.gold = 0;
  assert.equal(buy(w, 'p', 'upgrade', 'cannon').ok, false);
});

import { spawnBoss, exportPlayer, importPlayer } from './sim.js';
import { regionIndex, EVENT_EVERY } from '../shared/data.js';

test('régions : plus loin du port = région plus dangereuse', () => {
  assert.equal(regionIndex(2000, 2000), 0);
  assert.ok(regionIndex(2000 + 1200, 2000) > regionIndex(2000 + 400, 2000));
  assert.ok(regionIndex(0, 0) >= 4);
});

test('événement : le boss apparaît à l\'heure et rapporte gros', () => {
  const w = createWorld(3);
  const a = addPlayer(w, 'a', 'A');
  step(w, 0.05); assert.ok(!w.enemies.some((e) => e.boss));
  w.t = EVENT_EVERY + 1; step(w, 0.05);
  const boss = w.enemies.find((e) => e.boss);
  assert.ok(boss && boss.max > 4000, 'boss présent et costaud');
  assert.ok(w.events.some((e) => e.k === 'announce'));
  assert.equal(spawnBoss(w), true);
});

test('sauvegarde : valeurs hostiles bornées', () => {
  const w = createWorld(4);
  const p = addPlayer(w, 'a', 'A');
  importPlayer(p, { gold: 1e30, level: -5, ship: 99, up: { hull: 999, cannon: 'x' }, xp: NaN, guild: 12 });
  assert.ok(p.gold <= 1e9 && p.level === 1 && p.ship === 4 && p.up.hull === 10 && p.up.cannon === 0 && p.xp === 0 && p.guild === null);
  const e = exportPlayer(p); assert.equal(e.ship, 4);
});

test('alliés : pas de dégâts entre membres alliés', async () => {
  const { guildCommand } = await import('./guilds.js');
  const w = createWorld(5);
  const a = addPlayer(w, 'a', 'Alpha'), b = addPlayer(w, 'b', 'Bravo');
  a.gold = b.gold = 5000;
  const say = () => {}, online = (n) => (n === 'Bravo' ? b : null);
  guildCommand(w, a, ['creer', 'Rouge', 'ROU'], { say, online });
  guildCommand(w, a, ['inviter', 'Bravo'], { say, online });
  guildCommand(w, b, ['accepter'], { say, online });
  a.x = 1000; a.y = 1000; b.x = 1100; b.y = 1000; b.hp = 100;
  w.balls.push({ id: 1, x: 1090, y: 1000, vx: 500, vy: 0, life: 1, dmg: 50, team: 'p', type: 'ball', owner: 'a' });
  step(w, 0.02);
  assert.equal(b.hp >= 100, true, 'tir allié ignoré');
});
