// Équipement installable sur les navires : canons (selon le calibre) et mâts.
// Chaque navire a une capacité en canons (son nombre de bouches à feu) et une capacité en mâts.
// Les emplacements vides sont occupés par l'équipement d'origine, plus faible.
import type { ShipClassId } from './ships.ts';

export type CannonId = 'c30' | 'c50' | 'c60';
export type MastId = 'pin' | 'chene' | 'riga';
export type EquipId = CannonId | MastId;

export interface CannonDef { id: CannonId; kind: 'canon'; name: string; damage: number; range: number; reload: number; price: { or?: number; perles?: number; diamants?: number }; desc: string }
export interface MastDef { id: MastId; kind: 'mat'; name: string; speed: number; hp: number; price: { or?: number; perles?: number; diamants?: number }; desc: string }

/** Multiplicateurs par rapport au canon d'origine (18 livres, valeur 1). */
export const CANNONS: Record<CannonId, CannonDef> = {
  c30: { id: 'c30', kind: 'canon', name: 'Canon de 30 livres', damage: 1.35, range: 1.0, reload: 1.0, price: { or: 450 }, desc: 'Pièce de fonte robuste. Le bon compromis pour débuter.' },
  c50: { id: 'c50', kind: 'canon', name: 'Canon de 50 livres', damage: 1.8, range: 1.06, reload: 1.05, price: { perles: 2 }, desc: 'Gros calibre en bronze : coups dévastateurs, rechargement un peu plus lent.' },
  c60: { id: 'c60', kind: 'canon', name: 'Canon de 60 livres', damage: 2.3, range: 1.12, reload: 1.1, price: { diamants: 2 }, desc: 'Le plus lourd calibre de la flotte. Une bordée suffit à disloquer une coque.' },
};

export const MASTS: Record<MastId, MastDef> = {
  pin: { id: 'pin', kind: 'mat', name: 'Mât de pin', speed: 0.06, hp: 0.02, price: { or: 350 }, desc: 'Léger et souple : +6 % de vitesse à pleine capacité.' },
  chene: { id: 'chene', kind: 'mat', name: 'Mât de chêne', speed: 0.11, hp: 0.05, price: { perles: 1 }, desc: 'Solide et bien gréé : +11 % de vitesse, +5 % de coque.' },
  riga: { id: 'riga', kind: 'mat', name: 'Mât de Riga renforcé', speed: 0.17, hp: 0.08, price: { diamants: 1 }, desc: 'Le pin de la Baltique, cerclé de fer : +17 % de vitesse, +8 % de coque.' },
};

export const CANNON_ORDER: CannonId[] = ['c30', 'c50', 'c60'];
export const MAST_ORDER: MastId[] = ['pin', 'chene', 'riga'];
export const EQUIP_ORDER: EquipId[] = [...CANNON_ORDER, ...MAST_ORDER];
export const EQUIP_NAME = (id: EquipId) => (id in CANNONS ? CANNONS[id as CannonId].name : MASTS[id as MastId].name);
export const isCannon = (id: string): id is CannonId => id in CANNONS;
export const isMast = (id: string): id is MastId => id in MASTS;

export const MAST_CAPACITY: Record<ShipClassId, number> = {
  corvette: 8, brick: 12, fregate: 18, fregate_lourde: 24, vaisseau: 30, trois_ponts: 38, amiral: 44,
  voilier: 14, peche: 6, vedette: 4, patrouilleur: 10, fregate_moderne: 16,
};

/** Équipement installé sur un navire. */
export type Fit = Partial<Record<EquipId, number>>;

export function fitCount(fit: Fit | undefined, kind: 'canon' | 'mat') {
  if (!fit) return 0;
  const ids = kind === 'canon' ? CANNON_ORDER : MAST_ORDER;
  return ids.reduce((a, id) => a + (fit[id] ?? 0), 0);
}

/** Effet moyen de l'équipement, emplacements vides comptés comme équipement d'origine. */
export function fitEffects(fit: Fit | undefined, canons: number, mastCap: number) {
  let dmg = 0, range = 0, reload = 0, n = 0;
  for (const id of CANNON_ORDER) {
    const c = fit?.[id] ?? 0;
    dmg += c * CANNONS[id].damage; range += c * CANNONS[id].range; reload += c * CANNONS[id].reload; n += c;
  }
  const empty = Math.max(0, canons - n);
  dmg += empty; range += empty; reload += empty;
  const tot = Math.max(1, canons);
  let speed = 0, hp = 0;
  for (const id of MAST_ORDER) {
    const c = fit?.[id] ?? 0;
    speed += (c / Math.max(1, mastCap)) * MASTS[id].speed;
    hp += (c / Math.max(1, mastCap)) * MASTS[id].hp;
  }
  return { damage: dmg / tot, range: range / tot, reload: reload / tot, speed: 1 + speed, hp: 1 + hp };
}
