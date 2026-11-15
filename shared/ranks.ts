// Rangs : rang général (grades de la Marine française, places limitées), rang de bataille (40 échelons)
// et rang de pêche (20 échelons), chacun avec ses récompenses à réclamer.
import type { ConsumableId, AmmoId } from './items.ts';
import type { Profile } from './protocol.ts';
import { levelFromXp } from './progression.ts';

// --- Rang général ---------------------------------------------------------------
/** Grades du plus haut au plus bas ; `places` = nombre de capitaines pouvant le porter (0 = illimité). */
export const GRADES: { name: string; places: number; metal: 'or' | 'argent' | 'bronze' | 'fer' }[] = [
  { name: 'Amiral de France', places: 1, metal: 'or' },
  { name: 'Vice-amiral', places: 9, metal: 'or' },
  { name: 'Contre-amiral', places: 15, metal: 'or' },
  { name: 'Chef d\'escadre', places: 25, metal: 'argent' },
  { name: 'Capitaine de vaisseau', places: 25, metal: 'argent' },
  { name: 'Capitaine de frégate', places: 25, metal: 'argent' },
  { name: 'Capitaine de corvette', places: 25, metal: 'argent' },
  { name: 'Lieutenant de vaisseau', places: 25, metal: 'bronze' },
  { name: 'Enseigne de vaisseau', places: 25, metal: 'bronze' },
  { name: 'Aspirant', places: 25, metal: 'bronze' },
  { name: 'Garde de la Marine', places: 25, metal: 'bronze' },
  { name: 'Premier maître', places: 25, metal: 'fer' },
  { name: 'Maître d\'équipage', places: 25, metal: 'fer' },
  { name: 'Second maître', places: 25, metal: 'fer' },
  { name: 'Quartier-maître', places: 25, metal: 'fer' },
  { name: 'Matelot breveté', places: 25, metal: 'fer' },
  { name: 'Matelot', places: 25, metal: 'fer' },
  { name: 'Novice', places: 25, metal: 'fer' },
  { name: 'Mousse', places: 0, metal: 'fer' },
];

/** Points du rang général : ((XP / 750) + (points élite / 10 000) + (joueurs coulés / 3) + (trophées × 1 000)) × niveau. */
export function rankPoints(p: Pick<Profile, 'xp' | 'elite' | 'stats'>) {
  const lvl = levelFromXp(p.xp).level;
  return Math.round((p.xp / 750 + (p.elite ?? 0) / 10000 + (p.stats?.pvp ?? 0) / 3 + (p.stats?.boss ?? 0) * 1000) * lvl);
}
export const RANK_FORMULA = '((Points d\'expérience / 750) + (Points élite / 10 000) + (Joueurs coulés / 3) + (Trophées de boss × 1 000)) × Niveau';

/** Attribue les grades à une liste triée par points décroissants. */
export function assignGrades(sortedPoints: number[]): number[] {
  const out: number[] = [];
  let g = 0, used = 0;
  for (let i = 0; i < sortedPoints.length; i++) {
    while (GRADES[g].places && used >= GRADES[g].places) { g++; used = 0; }
    out.push(sortedPoints[i] > 0 ? g : GRADES.length - 1);
    used++;
  }
  return out;
}

// --- Rangs à échelons (bataille, pêche) ------------------------------------------
export interface StepReward { or?: number; perles?: number; diamants?: number; ammo?: Partial<Record<AmmoId, number>>; items?: Partial<Record<ConsumableId, number>> }

export const BATTLE_STEPS = 40;
/** Points de bataille = points de tir / 10 (dégâts infligés, joueurs coulés). */
export const battlePoints = (shootXp: number) => Math.floor((shootXp ?? 0) / 10);
export const battleThreshold = (n: number) => (n <= 1 ? 1 : Math.round(4 * Math.pow(n - 1, 3) + 8 * (n - 1)));
export function battleReward(n: number): StepReward {
  return {
    or: 2000 * n,
    ammo: { rouge: 50 * n, perle: 5 * n },
    items: { kit: 2 + Math.floor(n / 2), bouclier: Math.floor(n / 3), harpon_argent: Math.ceil(n / 2), vitesse: Math.floor(n / 4) },
    diamants: n % 5 === 0 ? n / 5 : 0,
  };
}

export const FISH_STEPS = 20;
export const fishThreshold = (n: number) => (n <= 1 ? 1 : Math.round(12 * Math.pow(n - 1, 2.6)));
export function fishReward(n: number): StepReward {
  return { or: 1500 * n, perles: Math.ceil(n / 2), items: { reparation: Math.ceil(n / 3) }, diamants: n % 5 === 0 ? 1 : 0 };
}

export function stepOf(points: number, threshold: (n: number) => number, max: number) {
  let n = 0;
  for (let k = 1; k <= max; k++) if (points >= threshold(k)) n = k;
  return n;
}

export function rewardText(r: StepReward, names: { ammo: (id: string) => string; item: (id: string) => string }) {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(r.ammo ?? {})) if (v) parts.push(`${v.toLocaleString('fr-FR')} ${names.ammo(k)}`);
  for (const [k, v] of Object.entries(r.items ?? {})) if (v) parts.push(`${v} ${names.item(k)}`);
  if (r.perles) parts.push(`${r.perles} perles`);
  if (r.diamants) parts.push(`${r.diamants} diamants`);
  if (r.or) parts.push(`${r.or.toLocaleString('fr-FR')} or`);
  return parts.join(', ');
}
