// Niveaux élite : les navires élites progressent avec les points élite (cumulés).
// Chaque niveau renforce la santé et la vitesse et apporte un bonus ; chaque navire élite a en plus sa spécialité.
import type { ShipDef, StatBonus } from './ships.ts';

export interface EliteLevel {
  level: number;
  points: number; // points élite cumulés requis
  hp: number; // bonus de santé (fraction)
  speed: number; // bonus de vitesse (fraction)
  dmg: number; // bonus de dégâts des canons
  harpon: number; // bonus de dégâts des harpons
  repair: number; // réparations renforcées
  canons: number; // bouches à feu supplémentaires
  feature: string;
}

const L = (level: number, points: number, extra: Partial<EliteLevel>, feature: string): EliteLevel => ({
  level, points, hp: 0.03 * (level - 1), speed: 0.004 * (level - 1), dmg: 0, harpon: 0, repair: 0, canons: 0, ...extra, feature,
});

export const ELITE_LEVELS: EliteLevel[] = [
  L(1, 0, { dmg: 0.01 }, '+1 % de dégâts des canons'),
  L(2, 30000, { dmg: 0.02 }, '+2 % de dégâts des canons'),
  L(3, 75000, { dmg: 0.03 }, '+3 % de dégâts des canons'),
  L(4, 140000, { dmg: 0.04 }, '+4 % de dégâts des canons'),
  L(5, 250000, { dmg: 0.05 }, '+5 % de dégâts des canons'),
  L(6, 500000, { dmg: 0.06 }, '+6 % de dégâts des canons'),
  L(7, 1200000, { dmg: 0.07 }, '+7 % de dégâts des canons'),
  L(8, 2500000, { dmg: 0.08 }, '+8 % de dégâts des canons'),
  L(9, 4500000, { dmg: 0.09 }, '+9 % de dégâts des canons'),
  L(10, 7500000, { dmg: 0.1 }, '+10 % de dégâts des canons'),
  L(11, 12000000, { dmg: 0.11 }, '+11 % de dégâts des canons'),
  L(12, 20000000, { dmg: 0.12 }, '+12 % de dégâts des canons'),
  L(13, 32000000, { dmg: 0.12, harpon: 0.1 }, '+12 % canons et +10 % de dégâts des harpons'),
  L(14, 48000000, { dmg: 0.12, harpon: 0.1, repair: 0.15 }, '+12 % canons, +10 % harpons, réparations +15 %'),
  L(15, 70000000, { dmg: 0.17, harpon: 0.15, repair: 0.15, canons: 6 }, '+17 % canons, +15 % harpons, réparations +15 %, 6 canons de plus'),
];

export function eliteLevel(points: number): EliteLevel {
  let cur = ELITE_LEVELS[0];
  for (const l of ELITE_LEVELS) if (points >= l.points) cur = l;
  return cur;
}

/** Spécialité propre à chaque navire élite. */
export const ELITE_SIGNATURES: Record<string, { label: string; bonus: StatBonus }> = {
  aigle_blanc: { label: 'Œil de l\'aigle : +8 % de portée et +10 % de dégâts des harpons', bonus: { range: 0.08, harpon: 0.1 } },
  dragon_vert: { label: 'Écailles du dragon : réparations +25 %', bonus: { repair: 0.25 } },
  salamandre: { label: 'Souffle de la salamandre : +6 % de dégâts, −5 % de rechargement', bonus: { dmg: 0.06, reload: 0.05 } },
  corsaire_noir: { label: 'Fantôme des convois : +8 % de vitesse', bonus: { speed: 0.08 } },
  lys_argent: { label: 'Bouclier d\'argent : +6 % de blindage', bonus: { armor: 0.06 } },
  licorne: { label: 'Corne écarlate : +10 % de dégâts', bonus: { dmg: 0.1 } },
  triton: { label: 'Faveur de Neptune : +10 % de coque et réparations +20 %', bonus: { hp: 0.1, repair: 0.2 } },
  etoile_roi: { label: 'Gloire du Roi : +6 % de dégâts, de coque, de portée et de vitesse', bonus: { dmg: 0.06, hp: 0.06, range: 0.06, speed: 0.06 } },
};

/** Bonus apportés par le navire actif s'il est élite (niveau élite + spécialité). */
export function eliteBonus(def: ShipDef | undefined, elitePoints: number): StatBonus {
  if (!def?.elite) return {};
  const l = eliteLevel(elitePoints);
  const sig = ELITE_SIGNATURES[def.id]?.bonus ?? {};
  return {
    hp: l.hp + (sig.hp ?? 0),
    speed: l.speed + (sig.speed ?? 0),
    dmg: l.dmg + (sig.dmg ?? 0),
    harpon: l.harpon + (sig.harpon ?? 0),
    repair: l.repair + (sig.repair ?? 0),
    canons: l.canons,
    armor: sig.armor ?? 0,
    range: sig.range ?? 0,
    reload: sig.reload ?? 0,
  };
}

// --- Livrées élites : chaque niveau élite repeint le navire (coque, bandeau, dorures, voiles) ---------------
// Le navire garde sa forme ; sa livrée s'assombrit et s'enrichit avec le niveau. À partir du niveau 10, un effet
// visible s'ajoute (éclats, braises, aura) pour que les autres capitaines reconnaissent un vétéran au premier regard.
export type EliteFx = 'eclats' | 'braises' | 'aura';
export interface EliteLivery { level: number; name: string; hull: number; stripe: number; trim: number; sail: number; glow?: number; fx?: EliteFx }

export const ELITE_LIVERIES: EliteLivery[] = [
  { level: 1, name: 'Toile neuve', hull: 0x5a3a22, stripe: 0x2a1d14, trim: 0xb8892b, sail: 0xf2ead6 },
  { level: 2, name: 'Vert de Bretagne', hull: 0x4a3a20, stripe: 0x3a5a2a, trim: 0xb8a04a, sail: 0xb8c890 },
  { level: 3, name: 'Cuivre de Saint-Malo', hull: 0x5a3018, stripe: 0x8a4a20, trim: 0xd08a40, sail: 0xd8a070 },
  { level: 4, name: 'Olive de campagne', hull: 0x3a3420, stripe: 0x5a5a30, trim: 0xa89a50, sail: 0xa8a478 },
  { level: 5, name: 'Or pâle', hull: 0x4a3418, stripe: 0x8a6a20, trim: 0xe0b440, sail: 0xe8d088 },
  { level: 6, name: 'Or royal', hull: 0x3a2810, stripe: 0xb8902a, trim: 0xffd060, sail: 0xf0c850, glow: 0x3a2a00 },
  { level: 7, name: 'Argent de Versailles', hull: 0x3a3c44, stripe: 0x9aa4b0, trim: 0xe0e6f0, sail: 0xc8ccd8 },
  { level: 8, name: 'Corbeau', hull: 0x1c1c22, stripe: 0x3a3a44, trim: 0x8a8a96, sail: 0x4a4a54 },
  { level: 9, name: 'Nuit dorée', hull: 0x181410, stripe: 0x2a2418, trim: 0xd8aa40, sail: 0x3a3428 },
  { level: 10, name: 'Braise', hull: 0x1a1210, stripe: 0x5a2010, trim: 0xff8a30, sail: 0x3a2a24, glow: 0x5a1a00, fx: 'eclats' },
  { level: 11, name: 'Bronze du Ponant', hull: 0x2a1c10, stripe: 0x8a5a20, trim: 0xe8a040, sail: 0x7a5a34, glow: 0x3a2400, fx: 'eclats' },
  { level: 12, name: 'Émeraude noire', hull: 0x101a14, stripe: 0x1f4a32, trim: 0x6fdc9c, sail: 0x2a3a30, glow: 0x0a3a1a, fx: 'eclats' },
  { level: 13, name: 'Pourpre de l\'Amiral', hull: 0x2a0c0c, stripe: 0x7a1a1a, trim: 0xff6a5a, sail: 0x9a2a2a, glow: 0x4a0a00, fx: 'braises' },
  { level: 14, name: 'Abysse', hull: 0x0c1020, stripe: 0x1a2a5a, trim: 0x7ab0ff, sail: 0x1f2a48, glow: 0x0a1a5a, fx: 'braises' },
  { level: 15, name: 'Légende des mers', hull: 0x0a0908, stripe: 0xb88a2a, trim: 0xffe08a, sail: 0x15120e, glow: 0x9a6a00, fx: 'aura' },
];

/** Apparence d'un navire élite à son niveau (les navires non élites gardent la leur). */
export function eliteLook<T extends { hull: number; stripe: number; trim: number; sail: number; glow?: number }>(look: T, level: number): T {
  const l = ELITE_LIVERIES[Math.max(1, Math.min(15, Math.floor(level))) - 1];
  return { ...look, hull: l.hull, stripe: l.stripe, trim: l.trim, sail: l.sail, glow: l.glow ?? look.glow };
}
