// Munitions, consommables, marchandises, améliorations et compétences.
import type { ShipUpgrades, Skills } from './ships.ts';

export type AmmoId = 'rond' | 'chaine' | 'mitraille' | 'rouge' | 'explosif';

export interface AmmoDef {
  id: AmmoId;
  name: string;
  short: string;
  hull: number; // multiplicateur de dégâts sur la coque
  sail: number; // multiplicateur de dégâts sur la voilure
  range: number; // multiplicateur de portée
  spread: number; // multiplicateur de dispersion
  fire: number; // probabilité d'incendie par impact
  crew: number; // secondes ajoutées au rechargement adverse (mitraille)
  price: { or?: number; perles?: number } | null; // prix par lot (null = illimité)
  pack: number;
  desc: string;
  color: number;
}

export const AMMO: Record<AmmoId, AmmoDef> = {
  rond: { id: 'rond', name: 'Boulet rond', short: 'Rond', hull: 1, sail: 0.3, range: 1, spread: 1, fire: 0.02, crew: 0, price: null, pack: 0, desc: 'Munition réglementaire, illimitée. Bon équilibre coque/voilure.', color: 0x222222 },
  chaine: { id: 'chaine', name: 'Boulet ramé', short: 'Ramé', hull: 0.35, sail: 2.4, range: 0.8, spread: 1.3, fire: 0, crew: 0, price: { or: 300 }, pack: 25, desc: 'Deux demi-boulets enchaînés : déchire la voilure et ralentit l\'ennemi.', color: 0x3a3a44 },
  mitraille: { id: 'mitraille', name: 'Mitraille', short: 'Mitr.', hull: 0.7, sail: 0.6, range: 0.55, spread: 2.4, fire: 0, crew: 2.5, price: { or: 350 }, pack: 25, desc: 'Courte portée. Fauche les servants : rechargement adverse ralenti.', color: 0x555555 },
  rouge: { id: 'rouge', name: 'Boulet rouge', short: 'Rouge', hull: 0.9, sail: 0.4, range: 0.9, spread: 1, fire: 0.3, crew: 0, price: { or: 500 }, pack: 25, desc: 'Chauffé au fourneau : met le feu au navire touché.', color: 0xff5a1a },
  explosif: { id: 'explosif', name: 'Obus explosif', short: 'Obus', hull: 1.75, sail: 0.6, range: 0.85, spread: 1.1, fire: 0.12, crew: 0.5, price: { perles: 2 }, pack: 10, desc: 'Projectile creux chargé de poudre. Dévastateur.', color: 0x2a2a2a },
};
export const AMMO_ORDER: AmmoId[] = ['rond', 'chaine', 'mitraille', 'rouge', 'explosif'];

export type ConsumableId = 'kit' | 'seau' | 'poudre';
export interface ConsumableDef { id: ConsumableId; name: string; price: { or: number }; key: string; desc: string; cooldown: number }
export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  kit: { id: 'kit', name: 'Kit de réparation', price: { or: 250 }, key: 'R', desc: 'Les charpentiers colmatent : +30 % de coque et de voilure en 6 s.', cooldown: 25 },
  seau: { id: 'seau', name: 'Pompes et seaux', price: { or: 120 }, key: 'F', desc: 'Éteint immédiatement un incendie à bord.', cooldown: 12 },
  poudre: { id: 'poudre', name: 'Poudre fine', price: { or: 400 }, key: 'G', desc: '+25 % de dégâts pendant 20 s.', cooldown: 60 },
};
export const CONSUMABLE_ORDER: ConsumableId[] = ['kit', 'seau', 'poudre'];

// --- Commerce ---------------------------------------------------------------
export type GoodId = 'vin' | 'sel' | 'toile' | 'bois' | 'epices' | 'rhum' | 'sucre' | 'cafe' | 'soie' | 'armes';
export interface GoodDef { id: GoodId; name: string; base: number }
export const GOODS: Record<GoodId, GoodDef> = {
  vin: { id: 'vin', name: 'Vin de Bordeaux', base: 60 },
  sel: { id: 'sel', name: 'Sel de Guérande', base: 25 },
  toile: { id: 'toile', name: 'Toile de Bretagne', base: 45 },
  bois: { id: 'bois', name: 'Bois de chêne', base: 35 },
  epices: { id: 'epices', name: 'Épices des Indes', base: 160 },
  rhum: { id: 'rhum', name: 'Rhum des Îles', base: 70 },
  sucre: { id: 'sucre', name: 'Sucre de canne', base: 55 },
  cafe: { id: 'cafe', name: 'Café', base: 90 },
  soie: { id: 'soie', name: 'Soie de Lyon', base: 200 },
  armes: { id: 'armes', name: 'Armes et poudre', base: 120 },
};
export const GOOD_ORDER = Object.keys(GOODS) as GoodId[];

// --- Ressources de construction ---------------------------------------------
export type MaterialId = 'bois' | 'toile' | 'fer';
export const MATERIAL_NAMES: Record<MaterialId, string> = { bois: 'Bois', toile: 'Toile', fer: 'Fer' };

// --- Améliorations -----------------------------------------------------------
export type UpgradeSlot = keyof ShipUpgrades;
export const MAX_UPGRADE = 5;
export const UPGRADE_INFO: Record<UpgradeSlot, { name: string; mat: MaterialId; effect: string }> = {
  coque: { name: 'Coque', mat: 'bois', effect: '+8 % de résistance, +2 % de blindage par niveau' },
  voiles: { name: 'Voiles', mat: 'toile', effect: '+4 % de vitesse, +5 % de maniabilité par niveau' },
  canons: { name: 'Canons', mat: 'fer', effect: '+7 % de dégâts, −4 % de rechargement par niveau' },
  boulets: { name: 'Boulets', mat: 'fer', effect: '+5 % de portée, tir plus précis par niveau' },
};
export function upgradeCost(tier: number, level: number) {
  return { or: Math.round(500 * tier * Math.pow(1.85, level)), mat: Math.round(4 * tier * (level + 1)) };
}

// --- Compétences -------------------------------------------------------------
export type SkillId = keyof Skills;
export const MAX_SKILL = 5;
export const SKILL_INFO: Record<SkillId, { name: string; effect: string }> = {
  artillerie: { name: 'Artillerie', effect: '+3 % de dégâts par rang' },
  navigation: { name: 'Navigation', effect: '+2 % de vitesse et +3 % de maniabilité par rang' },
  charpenterie: { name: 'Charpenterie', effect: '+10 % d\'efficacité des réparations et +3 % de coque par rang' },
  commerce: { name: 'Commerce', effect: '−3 % sur les achats et +3 % sur les ventes au marché par rang' },
};
