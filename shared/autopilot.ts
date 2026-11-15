// Pilote automatique partagé : navigation au clic (« va ici ») et manœuvre de combat (présenter le flanc).
// Utilisé par le serveur pour les joueurs et pour l'IA des PNJ.
import { clamp, wrapAngle } from './math.ts';
import type { HelmInput, ShipKinematics } from './physics.ts';
import type { ShipStats } from './ships.ts';
import { terrainHeight, type ZoneWorld } from './world.ts';

/** Corrige un cap souhaité pour ne pas foncer sur une île (sondes devant le navire). */
export function avoidLand(world: ZoneWorld, k: ShipKinematics, desired: number, blocked?: (x: number, z: number) => boolean): number {
  const look = 90 + k.speed * 5;
  const probe = (a: number, d: number) => terrainHeight(world, k.x + Math.sin(a) * d, k.z + Math.cos(a) * d) > -4;
  const ok = (a: number) => {
    if (probe(a, look) || probe(a, look * 0.5)) return false;
    return !blocked || !blocked(k.x + Math.sin(a) * look, k.z + Math.cos(a) * look);
  };
  if (ok(desired)) return desired;
  for (let i = 1; i <= 6; i++) {
    for (const s of [1, -1]) {
      const a = desired + s * i * 0.4;
      if (ok(a)) return a;
    }
  }
  return desired + Math.PI;
}

/** Barre à donner pour suivre un cap (rudder +1 = tribord, le cap diminue). */
export function rudderFor(k: ShipKinematics, desired: number) {
  return clamp(wrapAngle(k.h - desired) * 2.2, -1, 1);
}

export const ARRIVE_RADIUS = 30;

/** Navigation vers un point. Retourne null une fois arrivé. */
export function steerTo(world: ZoneWorld, k: ShipKinematics, tx: number, tz: number): HelmInput | null {
  const d = Math.hypot(tx - k.x, tz - k.z);
  if (d < ARRIVE_RADIUS) return null;
  const desired = avoidLand(world, k, Math.atan2(tx - k.x, tz - k.z));
  const sail = d > 260 ? 3 : d > 110 ? 2 : 1;
  return { sail, rudder: rudderFor(k, desired) };
}

/** Manœuvre de combat : garder la cible à bonne distance et lui présenter le flanc. */
export function combatHelm(world: ZoneWorld, k: ShipKinematics, st: ShipStats, tx: number, tz: number, range: number): HelmInput {
  const dx = tx - k.x, dz = tz - k.z;
  const d = Math.hypot(dx, dz);
  const bearing = Math.atan2(dx, dz);
  // Côté choisi : celui vers lequel la cible se trouve déjà (évite de virer de bord pour rien).
  const side = wrapAngle(bearing - k.h) > 0 ? 1 : -1; // +1 : cible à bâbord
  let desired: number;
  let sail = 2;
  if (d > range * 0.92) { desired = bearing - side * 0.35; sail = 3; }
  else if (d < range * 0.3) { desired = bearing + Math.PI + side * 0.5; sail = 3; }
  else { desired = bearing - side * (Math.PI / 2); sail = d < range * 0.55 ? 1 : 2; }
  void st;
  desired = avoidLand(world, k, desired);
  return { sail, rudder: rudderFor(k, desired) };
}
