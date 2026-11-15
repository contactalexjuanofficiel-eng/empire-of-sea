// Physique de navigation partagée : le serveur fait autorité, le client l'utilise pour prédire son propre navire.
import { clamp, wrapAngle } from './math.ts';
import type { ShipStats } from './ships.ts';
import { islandHeight, type ZoneWorld } from './world.ts';

/** Repère : x vers l'est, z vers le sud, cap h en radians. Avant du navire = (sin h, cos h).
 *  Tribord (droite) = (-cos h, sin h), bâbord (gauche) = (cos h, -sin h). Tourner à tribord = h diminue. */
export interface ShipKinematics { x: number; z: number; h: number; speed: number }
export interface HelmInput { sail: number; rudder: number } // sail 0..3, rudder -1 (bâbord) .. +1 (tribord)

export const SAIL_LEVELS = [0, 0.38, 0.7, 1];
export const SAIL_NAMES = ['Voiles carguées', 'Huniers', 'Demi-voilure', 'Toute la toile'];

export interface Wind { dir: number; strength: number } // dir = direction VERS laquelle souffle le vent

/** Facteur de vitesse selon l'allure : vent de travers (largue) le plus rapide, vent debout le plus lent. */
export function windFactor(h: number, wind: Wind): number {
  const rel = Math.abs(wrapAngle(h - wind.dir)); // 0 = vent arrière, PI = vent debout
  let f: number;
  if (rel < 0.8) f = 0.95 + 0.1 * (rel / 0.8); // vent arrière -> grand largue
  else if (rel < 1.9) f = 1.05 + 0.07 * Math.sin(((rel - 0.8) / 1.1) * Math.PI); // largue / travers
  else f = 1.05 - 0.55 * ((rel - 1.9) / (Math.PI - 1.9)); // près -> vent debout
  return 1 + (f - 1) * wind.strength;
}

export interface StepMods { speedMul?: number; sailRatio?: number }

export function stepShip(k: ShipKinematics, st: ShipStats, inp: HelmInput, wind: Wind, dt: number, mods: StepMods = {}) {
  const sail = SAIL_LEVELS[clamp(Math.round(inp.sail), 0, 3)];
  const sailRatio = mods.sailRatio ?? 1;
  const target = st.speed * sail * windFactor(k.h, wind) * (0.4 + 0.6 * sailRatio) * (mods.speedMul ?? 1);
  const acc = target > k.speed ? st.accel : st.accel * 1.4;
  if (k.speed < target) k.speed = Math.min(target, k.speed + acc * dt);
  else k.speed = Math.max(target, k.speed - acc * dt);
  const sp = clamp(k.speed / Math.max(1, st.speed), 0, 1.3);
  const turnRate = st.turn * (0.22 + 0.78 * Math.min(1, sp * 1.4));
  k.h = wrapAngle(k.h - clamp(inp.rudder, -1, 1) * turnRate * dt);
  k.x += Math.sin(k.h) * k.speed * dt;
  k.z += Math.cos(k.h) * k.speed * dt;
}

/** Collision avec les îles et les bords de la zone. Retourne l'intensité du choc (0 si aucun). */
export function collideShip(k: ShipKinematics, st: ShipStats, world: ZoneWorld, half: number): number {
  let shock = 0;
  const lim = half - 60;
  if (Math.abs(k.x) > lim || Math.abs(k.z) > lim) {
    k.x = clamp(k.x, -lim, lim);
    k.z = clamp(k.z, -lim, lim);
    k.speed *= 0.9;
  }
  const fx = Math.sin(k.h), fz = Math.cos(k.h);
  const halfLen = st.length * 0.45;
  for (const isl of world.islands) {
    const reach = isl.r * 1.15 + st.length;
    if (Math.abs(k.x - isl.x) > reach || Math.abs(k.z - isl.z) > reach) continue;
    for (const s of [1, 0, -1]) {
      const px = k.x + fx * halfLen * s, pz = k.z + fz * halfLen * s;
      const hgt = islandHeight(isl, px, pz);
      if (hgt > -1.5) {
        // Repousse le navire vers le large, perpendiculairement au littoral (approximé radialement).
        let dx = k.x - isl.x, dz = k.z - isl.z;
        const d = Math.hypot(dx, dz) || 1;
        dx /= d; dz /= d;
        const push = 2 + (hgt + 1.5) * 0.6;
        k.x += dx * push;
        k.z += dz * push;
        shock = Math.max(shock, k.speed);
        k.speed *= 0.6;
        break;
      }
    }
  }
  return shock;
}

// --- Balistique ------------------------------------------------------------
export const GRAVITY = 42;
export const MUZZLE_SPEED = 128;

/** Angle d'élévation pour atteindre la distance d (trajectoire tendue). */
export function elevationFor(d: number, v = MUZZLE_SPEED): number {
  const s = clamp((d * GRAVITY) / (v * v), 0, 1);
  return 0.5 * Math.asin(s);
}
export const maxBallisticRange = (v = MUZZLE_SPEED) => (v * v) / GRAVITY;

/** Points d'une trajectoire balistique (pour l'aperçu de visée). */
export function ballisticPoint(x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number) {
  return { x: x + vx * t, y: y + vy * t - 0.5 * GRAVITY * t * t, z: z + vz * t };
}
