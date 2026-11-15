// Génération déterministe du monde d'une zone : îles, ports, forts, épaves.
// Le client et le serveur appellent la même fonction avec la même graine : ils voient exactement le même monde,
// et le serveur utilise le même relief pour les collisions.
import { clamp, fbm2, rng } from './math.ts';
import type { PortDef, ZoneDef } from './zones.ts';

export interface Island {
  id: number;
  name: string;
  x: number;
  z: number;
  r: number;
  height: number;
  seed: number;
  port?: PortDef;
}

export interface FortDef {
  id: number;
  x: number;
  z: number;
  faction: 'france' | 'pirate';
  islandId: number;
  facing: number;
  name: string;
}

export interface WreckDef { id: number; x: number; z: number; h: number; name: string }

export interface ZoneWorld {
  islands: Island[];
  forts: FortDef[];
  wrecks: WreckDef[];
  /** Point d'accostage et de sortie de chaque port. */
  docks: Record<string, { x: number; z: number; h: number }>;
}

const WRECK_NAMES = ['la Licorne', 'l\'Espérance', 'la Méduse', 'le Prince de Conti', 'la Belle Hélène', 'le Saint-Esprit', 'la Fortune', 'le Glorieux', 'la Sirène d\'Or', 'le Neptune', 'l\'Astrolabe', 'la Boussole', 'le Magnifique', 'la Dauphine'];

const cache = new Map<string, ZoneWorld>();

export function buildWorld(zone: ZoneDef): ZoneWorld {
  const hit = cache.get(zone.id);
  if (hit) return hit;
  const R = rng(zone.seed);
  const islands: Island[] = [];
  let id = 1;
  for (const p of zone.ports) {
    islands.push({ id: id++, name: p.name, x: p.x, z: p.z, r: p.r, height: 70 + R() * 30, seed: Math.floor(R() * 1e6), port: p });
  }
  const names = [...zone.names];
  let tries = 0;
  while (islands.length < zone.ports.length + zone.islands && tries++ < 4000) {
    const small = R() < 0.3;
    const r = small ? 35 + R() * 50 : 90 + R() * 210;
    const x = (R() * 2 - 1) * (zone.half - r - 250);
    const z = (R() * 2 - 1) * (zone.half - r - 250);
    let ok = true;
    for (const o of islands) {
      const min = o.r + r + (o.port ? 700 : 260);
      if ((o.x - x) ** 2 + (o.z - z) ** 2 < min * min) { ok = false; break; }
    }
    if (!ok) continue;
    const name = names.length ? names.splice(Math.floor(R() * names.length), 1)[0] : `Îlot ${id}`;
    islands.push({ id: id++, name, x, z, r, height: small ? 12 + R() * 25 : 25 + R() * (r * 0.45), seed: Math.floor(R() * 1e6) });
  }

  const docks: ZoneWorld['docks'] = {};
  const forts: FortDef[] = [];
  let fid = 1;
  for (const isl of islands) {
    if (!isl.port) continue;
    // Le port fait face au centre de la zone.
    const a = Math.atan2(-isl.x, -isl.z);
    const dx = Math.sin(a), dz = Math.cos(a);
    docks[isl.port.id] = { x: isl.x + dx * (isl.r + 170), z: isl.z + dz * (isl.r + 170), h: a };
    for (const off of [-0.75, 0.75]) {
      const fa = a + off;
      forts.push({ id: fid++, x: isl.x + Math.sin(fa) * isl.r * 0.82, z: isl.z + Math.cos(fa) * isl.r * 0.82, faction: 'france', islandId: isl.id, facing: fa, name: `Fort de ${isl.name}` });
    }
  }
  // Repaires pirates fortifiés sur les plus grandes îles éloignées des ports.
  const candidates = islands
    .filter((i) => !i.port && i.r > 150)
    .filter((i) => zone.ports.every((p) => Math.hypot(p.x - i.x, p.z - i.z) > 1800))
    .sort((a, b) => b.r - a.r);
  for (let k = 0; k < Math.min(zone.pirateForts, candidates.length); k++) {
    const isl = candidates[k];
    const a = R() * Math.PI * 2;
    forts.push({ id: fid++, x: isl.x + Math.sin(a) * isl.r * 0.72, z: isl.z + Math.cos(a) * isl.r * 0.72, faction: 'pirate', islandId: isl.id, facing: a, name: `Repaire de ${isl.name}` });
  }

  const wrecks: WreckDef[] = [];
  tries = 0;
  while (wrecks.length < zone.wrecks && tries++ < 2000) {
    const x = (R() * 2 - 1) * (zone.half - 400);
    const z = (R() * 2 - 1) * (zone.half - 400);
    if (islands.some((i) => Math.hypot(i.x - x, i.z - z) < i.r + 160)) continue;
    if (zone.ports.some((p) => Math.hypot(p.x - x, p.z - z) < 1200)) continue;
    wrecks.push({ id: wrecks.length + 1, x, z, h: R() * Math.PI * 2, name: `Épave de ${WRECK_NAMES[wrecks.length % WRECK_NAMES.length]}` });
  }

  const w = { islands, forts, wrecks, docks };
  cache.set(zone.id, w);
  return w;
}

/** Rayon normalisé du littoral selon l'angle (0,88 à 1,12 × r). */
export function coastRadius(isl: Island, ang: number): number {
  const n = fbm2(Math.cos(ang) * 1.6 + 10, Math.sin(ang) * 1.6 + 10, isl.seed, 3);
  return isl.r * (0.82 + 0.36 * n);
}

/** Altitude du terrain d'une île au point (x, z), négative sous l'eau. */
export function islandHeight(isl: Island, x: number, z: number): number {
  const dx = x - isl.x, dz = z - isl.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d > isl.r * 1.4) return -30;
  const edge = coastRadius(isl, Math.atan2(dz, dx));
  const t = d / edge;
  if (t >= 1) return -clamp((t - 1) * isl.r * 0.6, 0, 30);
  const beach = clamp((1 - t) / 0.12, 0, 1) * 2.2;
  const inland = clamp((0.86 - t) / 0.86, 0, 1);
  const rough = 0.5 + 0.9 * fbm2(x * 0.007 + 31, z * 0.007 - 17, isl.seed, 4);
  let h = beach + isl.height * Math.pow(inland, 1.35) * rough;
  if (isl.port) {
    // Terrasse plate pour la ville, côté port.
    h = Math.min(h, 8 + isl.height * Math.pow(inland, 2.2));
  }
  return h;
}

/** Altitude maximale des terrains au point (x, z) (−30 en pleine mer). */
export function terrainHeight(world: ZoneWorld, x: number, z: number): number {
  let best = -30;
  for (const isl of world.islands) {
    const lim = isl.r * 1.4;
    if (Math.abs(x - isl.x) > lim || Math.abs(z - isl.z) > lim) continue;
    const h = islandHeight(isl, x, z);
    if (h > best) best = h;
  }
  return best;
}
