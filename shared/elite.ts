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
