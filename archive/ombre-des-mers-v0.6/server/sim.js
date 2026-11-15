// Cœur de simulation du monde — pur, sans réseau, testable avec `node --test`.
// Le serveur est l'AUTORITÉ : or, dégâts, XP et positions sont décidés ici, jamais par le client.

import { WORLD, SHIPS, ENEMY_TYPES, NAMES, ISLAND_NAMES, UPGRADE_MAX, upgradeCost, REGIONS, regionIndex, EVENT_EVERY, BOSS_NAMES } from '../shared/data.js';
import { friendly, atWar, tagOf } from './guilds.js';

// Port de départ : zone sûre (pas de combat entre joueurs), réparations et boutique.
export const PORT = { x: 2000, y: 2000, r: 220, name: 'Port-Royal-de-France' };
export const inPort = (o) => Math.hypot(o.x - PORT.x, o.y - PORT.y) < PORT.r;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Générateur pseudo-aléatoire déterministe (même graine = même monde).
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function statsOf(p) {
  const sh = SHIPS[p.ship];
  return {
    maxHp: 100 + 40 * p.up.hull + sh.hp,
    dmg: 14 + 4 * p.up.cannon,
    spd: 140 + 16 * p.up.sail + sh.spd,
    reload: Math.max(0.8, 2.2 - 0.15 * p.up.reload),
    guns: 3 + Math.floor(p.up.cannon / 4) + sh.guns,
  };
}

export function createWorld(seed = 20261114) {
  const rng = mulberry32(seed);
  const islands = [];
  for (let i = 0; i < 18; i++) {
    let x, y, r, ok = false;
    for (let t = 0; t < 300 && !ok; t++) {
      x = 300 + rng() * (WORLD - 600);
      y = 300 + rng() * (WORLD - 600);
      r = 90 + rng() * 150;
      ok = Math.hypot(x - 2000, y - 2000) > r + 500 &&
        islands.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 260);
    }
    if (ok) islands.push({ x, y, r, name: ISLAND_NAMES[islands.length % ISLAND_NAMES.length] });
  }
  return { t: 0, rng, islands, players: new Map(), enemies: [], balls: [], events: [], nextId: 1, spawnT: 1, nextEvent: EVENT_EVERY, guilds: new Map() };
}

export function addPlayer(w, id, name = 'Capitaine') {
  const p = {
    id, name, x: 2000, y: 2000, a: -Math.PI / 2, v: 0, r: SHIPS[0].r,
    ship: 0, level: 1, xp: 0, gold: 0, elite: 0, sunk: 0, dmgTotal: 0,
    up: { hull: 0, cannon: 0, sail: 0, reload: 0 },
    hp: 0, cdL: 0, cdR: 0, lastHit: -99,
    input: { steer: 0, throttle: 0.3 },
  };
  p.hp = statsOf(p).maxHp;
  w.players.set(id, p);
  return p;
}

export function removePlayer(w, id) { w.players.delete(id); }

// Entrées d'un joueur : on ne fait jamais confiance au client, on borne tout.
export function setInput(w, id, inp) {
  const p = w.players.get(id);
  if (!p || !inp) return;
  const steer = Number(inp.steer), thr = Number(inp.throttle);
  p.input = {
    steer: Number.isFinite(steer) ? clamp(steer, -1, 1) : 0,
    throttle: Number.isFinite(thr) ? clamp(thr, 0, 1) : 0.3,
  };
}

function spawnBalls(w, o, ang, dmg, team, n, r, type, owner) {
  const fx = Math.cos(o.a), fy = Math.sin(o.a), sx = Math.cos(ang), sy = Math.sin(ang);
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * Math.min(r * 0.7, (40 / Math.max(1, n - 1)) * 1.2);
    const x = o.x + fx * off + sx * r * 0.7, y = o.y + fy * off + sy * r * 0.7;
    const a = ang + (w.rng() * 2 - 1) * 0.05, sp = 500 + w.rng() * 40;
    w.balls.push({ id: w.nextId++, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.95, dmg, team, type, owner });
  }
}

// side : -1 = bâbord, +1 = tribord.
export function fire(w, id, side) {
  const p = w.players.get(id);
  if (!p) return false;
  const cd = side < 0 ? 'cdL' : 'cdR';
  if (p[cd] > 0) return false;
  const S = statsOf(p);
  spawnBalls(w, p, p.a + (side < 0 ? -1 : 1) * Math.PI / 2, S.dmg, 'p', S.guns, p.r, 'ball', p.id);
  p[cd] = S.reload;
  return true;
}

function collideIslands(w, o, r) {
  for (const i of w.islands) {
    const dx = o.x - i.x, dy = o.y - i.y, d = Math.hypot(dx, dy), lim = i.r + r;
    if (d < lim && d > 0) { o.x = i.x + (dx / d) * lim; o.y = i.y + (dy / d) * lim; o.v *= 0.96; }
  }
  o.x = clamp(o.x, 50, WORLD - 50);
  o.y = clamp(o.y, 50, WORLD - 50);
}

function avoid(w, o, want, pad) {
  let vx = Math.cos(want), vy = Math.sin(want);
  for (const i of w.islands) {
    const ix = o.x - i.x, iy = o.y - i.y, id = Math.hypot(ix, iy), lim = i.r + pad;
    if (id < lim && id > 0) { const k = ((lim - id) / lim) * 3; vx += (ix / id) * k; vy += (iy / id) * k; }
  }
  return Math.atan2(vy, vx);
}

function pick(w, arr) { return arr[Math.floor(w.rng() * arr.length)]; }

function spawnEnemy(w) {
  const players = [...w.players.values()];
  if (!players.length) return;
  const pl = pick(w, players), L = pl.level, p = w.rng();
  let ti = 0;
  if (L >= 3) ti = p < 0.7 ? 0 : 1;
  if (L >= 6) ti = p < 0.5 ? 0 : p < 0.85 ? 1 : 2;
  if (L >= 9) ti = p < 0.35 ? 0 : p < 0.65 ? 1 : p < 0.92 ? 2 : 3;
  ti = Math.min(ENEMY_TYPES.length - 1, ti + REGIONS[regionIndex(pl.x, pl.y)].tier);
  const t = ENEMY_TYPES[ti];
  for (let k = 0; k < 30; k++) {
    const a = w.rng() * TAU, d = 750 + w.rng() * 350;
    const x = clamp(pl.x + Math.cos(a) * d, 80, WORLD - 80), y = clamp(pl.y + Math.sin(a) * d, 80, WORLD - 80);
    if (w.islands.some((i) => Math.hypot(i.x - x, i.y - y) < i.r + 90)) continue;
    if (players.some((q) => Math.hypot(q.x - x, q.y - y) < 650)) continue;
    const sc = 1 + 0.06 * (L - 1);
    w.enemies.push({
      id: w.nextId++, ti, name: pick(w, NAMES[ti]), lv: L + ti, x, y, a: w.rng() * TAU, v: t.spd * 0.6,
      hp: t.hp * sc, max: t.hp * sc, dmg: t.dmg * (1 + 0.04 * (L - 1)), cd: 1 + w.rng() * 2, slow: 0,
    });
    w.enemies[w.enemies.length - 1].reg = regionIndex(x, y);
    return;
  }
}

function updEnemy(w, e, dt) {
  const t = ENEMY_TYPES[e.ti];
  let near = null, nd = 1500;
  for (const p of w.players.values()) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < nd) { nd = d; near = p; }
  }
  let want = e.a, d = nd, to = e.a;
  if (near) {
    to = Math.atan2(near.y - e.y, near.x - e.x);
    if (d > 400) want = to;
    else { const s = angDiff(e.a, to) > 0 ? 1 : -1; want = to - (s * Math.PI) / 2; }
  }
  want = avoid(w, e, want, 140);
  e.a += clamp(angDiff(e.a, want), -1.3 * dt, 1.3 * dt);
  const targetSpd = (near && d < 300 ? t.spd * 0.6 : t.spd) * (e.slow > 0 ? 0.5 : 1);
  e.slow = Math.max(0, e.slow - dt);
  e.v += (targetSpd - e.v) * Math.min(1, dt * 1.5);
  e.x += Math.cos(e.a) * e.v * dt;
  e.y += Math.sin(e.a) * e.v * dt;
  collideIslands(w, e, t.r);
  e.cd -= dt;
  if (near && d < 470 && e.cd <= 0) {
    const sd = angDiff(e.a, to);
    if (Math.abs(Math.abs(sd) - Math.PI / 2) < 0.35) {
      spawnBalls(w, e, e.a + Math.sign(sd) * Math.PI / 2, e.dmg, 'e', t.guns, t.r, 'ball', e.id);
      e.cd = t.rl + w.rng() * 0.8;
    }
  }
}

function hurtPlayer(w, p, d, killer) {
  p.hp -= d;
  p.lastHit = w.t;
  if (p.hp <= 0) {
    const lost = Math.floor(p.gold * 0.3);
    p.gold -= lost;
    p.x = 2000; p.y = 2000; p.v = 0; p.hp = statsOf(p).maxHp;
    w.events.push({ k: 'sunk', id: p.id, lost });
    if (killer && killer !== p) {
      const bounty = (Math.floor(lost * 0.5) + 25) * (atWar(w, killer, p) ? 2 : 1);
      killer.gold += bounty; killer.xp += 40; killer.pvpKills = (killer.pvpKills || 0) + 1;
      w.events.push({ k: 'pvp', id: killer.id, victim: p.name, gold: bounty });
      levelUp(w, killer);
    }
  }
}

function levelUp(w, o) {
  while (o.xp >= o.level * 100) {
    o.xp -= o.level * 100; o.level++; o.hp = statsOf(o).maxHp;
    w.events.push({ k: 'level', id: o.id, level: o.level });
  }
}

function killEnemy(w, e, owner) {
  const t = ENEMY_TYPES[e.ti];
  const g = Math.round(t.gold * (0.8 + w.rng() * 0.5) * REGIONS[regionIndex(e.x, e.y)].mult * (e.boss ? 5 : 1));
  owner.gold += g; owner.xp += t.xp * (e.boss ? 5 : 1); owner.sunk++;
  if (e.boss) w.events.push({ k: 'announce', text: owner.name + ' a coulé ' + e.name + ' et gagne ' + g + ' or !' });
  levelUp(w, owner);
  w.events.push({ k: 'kill', id: owner.id, enemy: e.name, gold: g });
}

export function step(w, dt) {
  w.t += dt;
  w.events = [];

  for (const p of w.players.values()) {
    const S = statsOf(p);
    p.r = SHIPS[p.ship].r;
    const k = 0.3 + 0.7 * Math.min(1, p.v / S.spd);
    p.a += p.input.steer * 1.7 * dt * k;
    p.v += (p.input.throttle * S.spd - p.v) * Math.min(1, dt * 1.3);
    p.x += Math.cos(p.a) * p.v * dt;
    p.y += Math.sin(p.a) * p.v * dt;
    collideIslands(w, p, p.r);
    p.cdL = Math.max(0, p.cdL - dt);
    p.cdR = Math.max(0, p.cdR - dt);
    if (w.t - p.lastHit > 6) p.hp = Math.min(S.maxHp, p.hp + 0.6 * dt);
    if (inPort(p)) p.hp = Math.min(S.maxHp, p.hp + S.maxHp * 0.05 * dt);
  }

  if (w.players.size && w.t >= w.nextEvent) spawnBoss(w);
  w.spawnT -= dt;
  const avgLevel = w.players.size ? [...w.players.values()].reduce((s, p) => s + p.level, 0) / w.players.size : 1;
  const maxE = Math.min(10 * Math.max(1, w.players.size), 3 + Math.floor(avgLevel / 1.5) * Math.max(1, w.players.size));
  if (w.spawnT <= 0 && w.enemies.length < maxE) { spawnEnemy(w); w.spawnT = 2 + w.rng() * 2; }
  for (const e of w.enemies) updEnemy(w, e, dt);

  for (let i = w.balls.length - 1; i >= 0; i--) {
    const b = w.balls[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && w.islands.some((is) => Math.hypot(b.x - is.x, b.y - is.y) < is.r * 0.9)) dead = true;
    if (!dead && b.team === 'p') {
      for (let j = w.enemies.length - 1; j >= 0; j--) {
        const e = w.enemies[j], t = ENEMY_TYPES[e.ti];
        if (Math.hypot(b.x - e.x, b.y - e.y) < t.r + 5) {
          e.hp -= b.dmg; dead = true;
          const owner = w.players.get(b.owner);
          if (owner) { owner.dmgTotal += b.dmg; owner.elite += b.dmg * 0.25; }
          if (e.hp <= 0) { if (owner) killEnemy(w, e, owner); w.enemies.splice(j, 1); }
          break;
        }
      }
      if (!dead) {
        for (const q of w.players.values()) {
          if (q.id === b.owner || inPort(q)) continue;
          const ow = w.players.get(b.owner);
          if (ow && friendly(w, ow, q)) continue;
          if (Math.hypot(b.x - q.x, b.y - q.y) < q.r + 5) {
            dead = true;
            const owner = w.players.get(b.owner);
            if (owner) owner.dmgTotal += b.dmg;
            hurtPlayer(w, q, b.dmg, owner);
            break;
          }
        }
      }
    } else if (!dead && b.team === 'e') {
      for (const p of w.players.values()) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r + 5) { dead = true; hurtPlayer(w, p, b.dmg); break; }
      }
    }
    if (dead) w.balls.splice(i, 1);
  }
}

const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

// Instantané compact envoyé aux clients (20 fois par seconde).
export function snapshot(w) {
  return {
    time: r1(w.t),
    players: [...w.players.values()].map((p) => ({
      id: p.id, name: p.name, x: r1(p.x), y: r1(p.y), a: r3(p.a), v: r1(p.v),
      hp: r1(p.hp), maxHp: statsOf(p).maxHp, ship: p.ship, level: p.level, gold: p.gold, xp: p.xp, reg: regionIndex(p.x, p.y), guild: tagOf(w, p), elite: Math.round(p.elite), up: p.up, pvp: !inPort(p),
    })),
    enemies: w.enemies.map((e) => ({ id: e.id, ti: e.ti, name: e.name, lv: e.lv, x: r1(e.x), y: r1(e.y), a: r3(e.a), hp: r1(e.hp), max: r1(e.max), boss: !!e.boss })),
    balls: w.balls.map((b) => ({ x: r1(b.x), y: r1(b.y), vx: r1(b.vx), vy: r1(b.vy), team: b.team })),
    events: w.events,
  };
}

// Boutique : uniquement dans la zone du port. Retourne { ok, msg }.
export function buy(w, id, kind, arg) {
  const p = w.players.get(id);
  if (!p) return { ok: false, msg: 'Joueur inconnu' };
  if (!inPort(p)) return { ok: false, msg: 'Il faut être au port' };
  if (kind === 'upgrade') {
    if (typeof arg !== 'string' || !Object.hasOwn(p.up, arg)) return { ok: false, msg: 'Amélioration inconnue' };
    const lv = p.up[arg];
    if (lv >= UPGRADE_MAX) return { ok: false, msg: 'Niveau maximum' };
    const c = upgradeCost(lv);
    if (p.gold < c) return { ok: false, msg: 'Or insuffisant' };
    const ratio = p.hp / statsOf(p).maxHp;
    p.gold -= c; p.up[arg]++;
    p.hp = statsOf(p).maxHp * ratio;
    return { ok: true, msg: 'Amélioration achetée' };
  }
  if (kind === 'ship') {
    const i = Number(arg);
    if (!Number.isInteger(i) || i < 0 || i >= SHIPS.length || i <= p.ship) return { ok: false, msg: 'Navire indisponible' };
    const sh = SHIPS[i];
    if (p.elite < sh.req) return { ok: false, msg: 'Points d\'élite insuffisants' };
    if (p.gold < sh.price) return { ok: false, msg: 'Or insuffisant' };
    p.gold -= sh.price; p.ship = i; p.r = sh.r; p.hp = statsOf(p).maxHp;
    return { ok: true, msg: 'Nouveau navire : ' + sh.n };
  }
  return { ok: false, msg: 'Achat inconnu' };
}

// Événement mondial : un navire amiral géant apparaît loin du port.
export function spawnBoss(w) {
  w.nextEvent = w.t + EVENT_EVERY;
  const t = ENEMY_TYPES[ENEMY_TYPES.length - 1];
  for (let k = 0; k < 40; k++) {
    const a = w.rng() * TAU, d = 900 + w.rng() * 800;
    const x = clamp(2000 + Math.cos(a) * d, 100, WORLD - 100), y = clamp(2000 + Math.sin(a) * d, 100, WORLD - 100);
    if (w.islands.some((i) => Math.hypot(i.x - x, i.y - y) < i.r + 120)) continue;
    const name = BOSS_NAMES[Math.floor(w.rng() * BOSS_NAMES.length)];
    w.enemies.push({ id: w.nextId++, ti: ENEMY_TYPES.length - 1, name, lv: 15, x, y, a: w.rng() * TAU, v: t.spd * 0.5, hp: t.hp * 6, max: t.hp * 6,
      dmg: t.dmg * 1.5, cd: 2, slow: 0, boss: true, reg: regionIndex(x, y) });
    w.events.push({ k: 'announce', text: '⚓ ' + name + ' et son escadre ont été signalés en ' + REGIONS[regionIndex(x, y)].name + ' !' });
    return true;
  }
  return false;
}

// Sauvegarde / restauration de la progression (valeurs validées : un fichier modifié ne donne pas de super-pouvoirs).
const num = (v, lo, hi, d = 0) => (Number.isFinite(Number(v)) ? clamp(Math.floor(Number(v)), lo, hi) : d);
export function exportPlayer(p) {
  return { gold: p.gold, xp: p.xp, level: p.level, elite: Math.round(p.elite), ship: p.ship, up: { ...p.up }, sunk: p.sunk, pvpKills: p.pvpKills || 0, guild: p.guild || null };
}
export function importPlayer(p, s) {
  if (!s || typeof s !== 'object') return;
  p.gold = num(s.gold, 0, 1e9); p.xp = num(s.xp, 0, 1e9); p.level = num(s.level, 1, 200, 1); p.elite = num(s.elite, 0, 1e9);
  p.ship = num(s.ship, 0, SHIPS.length - 1); p.r = SHIPS[p.ship].r; p.sunk = num(s.sunk, 0, 1e9); p.pvpKills = num(s.pvpKills, 0, 1e9);
  for (const k of Object.keys(p.up)) p.up[k] = num(s.up && s.up[k], 0, UPGRADE_MAX);
  p.guild = typeof s.guild === 'string' ? s.guild : null;
  p.hp = statsOf(p).maxHp;
}
