// Intelligence des navires PNJ : patrouille, approche, manœuvre pour présenter le flanc, tir avec anticipation, fuite.
// Les PNJ sont toujours identifiés comme tels côté client : ils ne se font jamais passer pour des joueurs.
import { clamp, dist2, wrapAngle } from '../../shared/math.ts';
import { avoidLand } from '../../shared/autopilot.ts';
import { terrainHeight } from '../../shared/world.ts';
import type { ShipEnt } from './entities.ts';
import type { Zone } from './Zone.ts';

export function thinkNPC(z: Zone, s: ShipEnt, dt: number) {
  const ai = s.ai!;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 0.6 + Math.random() * 0.4;
    retarget(z, s);
  }
  const range = s.stats.range;
  let desired = s.k.h;
  let sail = 2;
  const tgt = ai.target ? z.ships.get(ai.target) : undefined;

  if (ai.mode === 'combat' && tgt && tgt.sinking < 0) {
    const dx = tgt.k.x - s.k.x, dz = tgt.k.z - s.k.z;
    const d = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, dz);
    if (d > range * 0.95) {
      desired = bearing + ai.side * 0.35; // approche en biais
      sail = 3;
    } else if (d < range * 0.3) {
      desired = bearing + Math.PI - ai.side * 0.5; // trop près : on dégage
      sail = 3;
    } else {
      // Présente le flanc : cap perpendiculaire au relèvement de la cible.
      desired = bearing - ai.side * (Math.PI / 2);
      sail = d < range * 0.55 ? 2 : 3;
    }
    tryFire(z, s, tgt, d, bearing);
  } else if (ai.mode === 'fuite' && tgt) {
    desired = Math.atan2(s.k.x - tgt.k.x, s.k.z - tgt.k.z);
    sail = 3;
  } else {
    if (ai.mode === 'retour') {
      ai.wx = ai.homeX;
      ai.wz = ai.homeZ;
    }
    if (dist2(s.k.x, s.k.z, ai.wx, ai.wz) < 160 * 160) {
      if (ai.mode === 'retour') ai.mode = 'patrouille';
      newWaypoint(z, s);
    }
    desired = Math.atan2(ai.wx - s.k.x, ai.wz - s.k.z);
    sail = s.kind === 'boss' ? 2 : 2;
  }

  desired = avoidLand(z.world, s.k, desired, (x, w) => z.inSafeZone(x, w));
  const diff = wrapAngle(s.k.h - desired);
  s.input.rudder = clamp(diff * 2.2, -1, 1);
  s.input.sail = sail;
}

function retarget(z: Zone, s: ShipEnt) {
  const ai = s.ai!;
  const hpR = s.hp / s.stats.hp;
  if (s.kind === 'npc' && hpR < 0.18 && ai.mode === 'combat' && Math.random() < 0.35) {
    ai.mode = 'fuite';
    return;
  }
  if (dist2(s.k.x, s.k.z, ai.homeX, ai.homeZ) > 2600 * 2600 && ai.mode !== 'combat') {
    ai.mode = 'retour';
    return;
  }
  // Cible la plus proche parmi les joueurs attaquables ; on se souvient de qui nous a frappé.
  let best = 0, bestD = ai.aggro * ai.aggro;
  for (const o of z.ships.values()) {
    if (o.kind !== 'player' || o.sinking >= 0 || !z.canHarm(s, o)) continue;
    let d = dist2(s.k.x, s.k.z, o.k.x, o.k.z);
    if (s.dmgBy.has(o.id)) d *= 0.4;
    if (d < bestD) { bestD = d; best = o.id; }
  }
  if (best) {
    if (ai.target !== best) ai.side = Math.random() < 0.5 ? 1 : -1;
    ai.target = best;
    if (ai.mode !== 'fuite') ai.mode = 'combat';
  } else if (ai.mode === 'combat' || ai.mode === 'fuite') {
    ai.mode = 'patrouille';
    ai.target = 0;
    newWaypoint(z, s);
  }
}

export function newWaypoint(z: Zone, s: ShipEnt) {
  const ai = s.ai!;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 300 + Math.random() * (s.kind === 'boss' ? 1800 : 1100);
    const x = clamp(ai.homeX + Math.sin(a) * r, -z.def.half + 300, z.def.half - 300);
    const w = clamp(ai.homeZ + Math.cos(a) * r, -z.def.half + 300, z.def.half - 300);
    if (terrainHeight(z.world, x, w) < -5 && !z.inSafeZone(x, w)) {
      ai.wx = x;
      ai.wz = w;
      return;
    }
  }
  ai.wx = ai.homeX;
  ai.wz = ai.homeZ;
}

function tryFire(z: Zone, s: ShipEnt, tgt: ShipEnt, d: number, bearing: number) {
  if (d > s.stats.range * 0.98) return;
  const rel = wrapAngle(bearing - s.k.h);
  // Bâbord à +PI/2, tribord à -PI/2 par rapport au cap.
  const sides: [0 | 1, number][] = [[0, Math.PI / 2], [1, -Math.PI / 2]];
  for (const [i, center] of sides) {
    if (s.reload[i] > 0) continue;
    if (Math.abs(wrapAngle(rel - center)) > 0.5) continue;
    // Anticipation : on vise là où sera la cible à l'arrivée du boulet, avec une erreur selon le niveau.
    const flight = d / 110;
    const err = (1 - s.ai!.accuracy) * 60;
    const ax = tgt.k.x + Math.sin(tgt.k.h) * tgt.k.speed * flight + (Math.random() - 0.5) * err;
    const az = tgt.k.z + Math.cos(tgt.k.h) * tgt.k.speed * flight + (Math.random() - 0.5) * err;
    z.fireSide(s, i === 0 ? 'babord' : 'tribord', ax, az);
  }
}
