// Munitions, consommables, marchandises, améliorations et compétences.
import type { ShipUpgrades, Skills } from './ships.ts';

export type AmmoId = 'rond' | 'chaine' | 'mitraille' | 'rouge' | 'explosif' | 'perle' | 'diamant';

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
  price: { or?: number; perles?: number; diamants?: number } | null; // prix par lot (null = illimité)
  elite: number; // multiplicateur des points élite gagnés avec ces boulets
  pack: number;
  desc: string;
  color: number;
}

export const AMMO: Record<AmmoId, AmmoDef> = {
  rond: { id: 'rond', name: 'Boulet rond', short: 'Rond', hull: 1, sail: 0.3, range: 1, spread: 1, fire: 0.02, elite: 1, crew: 0, price: null, pack: 0, desc: 'Munition réglementaire, illimitée. Bon équilibre coque/voilure.', color: 0x222222 },
  chaine: { id: 'chaine', name: 'Boulet ramé', short: 'Ramé', hull: 0.35, sail: 2.4, range: 0.8, spread: 1.3, fire: 0, elite: 1, crew: 0, price: { or: 300 }, pack: 25, desc: 'Deux demi-boulets enchaînés : déchire la voilure et ralentit l\'ennemi.', color: 0x3a3a44 },
  mitraille: { id: 'mitraille', name: 'Mitraille', short: 'Mitr.', hull: 0.7, sail: 0.6, range: 0.55, spread: 2.4, fire: 0, elite: 1, crew: 2.5, price: { or: 350 }, pack: 25, desc: 'Courte portée. Fauche les servants : rechargement adverse ralenti.', color: 0x555555 },
  rouge: { id: 'rouge', name: 'Boulet rouge', short: 'Rouge', hull: 0.9, sail: 0.4, range: 0.9, spread: 1, fire: 0.3, elite: 1, crew: 0, price: { or: 500 }, pack: 25, desc: 'Chauffé au fourneau : met le feu au navire touché.', color: 0xff5a1a },
  perle: { id: 'perle', name: 'Boulet de perle', short: 'Perle', hull: 1.35, sail: 0.6, range: 1, spread: 0.9, fire: 0.05, crew: 0.5, elite: 5, price: { perles: 1 }, pack: 10, desc: 'Boulet nacré d\'une précision redoutable. Rapporte 5 fois plus de points élite.', color: 0xf2eee0 },
  diamant: { id: 'diamant', name: 'Boulet de diamant', short: 'Diam.', hull: 1.7, sail: 0.8, range: 1.05, spread: 0.8, fire: 0.1, crew: 1, elite: 12, price: { diamants: 1 }, pack: 10, desc: 'Le projectile des amiraux : perce toutes les coques. Rapporte 12 fois plus de points élite.', color: 0x9fe8ff },
  explosif: { id: 'explosif', name: 'Obus explosif', short: 'Obus', hull: 1.75, sail: 0.6, range: 0.85, spread: 1.1, fire: 0.12, elite: 1, crew: 0.5, price: { perles: 2 }, pack: 10, desc: 'Projectile creux chargé de poudre. Dévastateur.', color: 0x2a2a2a },
};
export const AMMO_ORDER: AmmoId[] = ['rond', 'chaine', 'mitraille', 'rouge', 'explosif', 'perle', 'diamant'];

export type ConsumableId =
  | 'kit' | 'seau' | 'poudre'
  | 'reparation' | 'vitesse' | 'harpon_bronze' | 'harpon_argent' | 'harpon_or' | 'feu_gregeois' | 'brulot'
  | 'bouclier' | 'corne' | 'fumigene' | 'lanterne' | 'parchemin' | 'coffre_amiral';
export type ItemCat = 'soin' | 'combat' | 'soutien' | 'tresor';
export interface ConsumableDef {
  id: ConsumableId; name: string; price: { or?: number; perles?: number; diamants?: number }; key: string; desc: string; cooldown: number;
  cat: ItemCat; icon: string; target?: boolean; range?: number; value?: number; duration?: number;
}
/** Objets utilisables en mer : les trois de base et ceux de la Boutique de l'Amirauté. */
export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  kit: { id: 'kit', name: 'Kit de réparation', price: { or: 250 }, key: '', cat: 'soin', icon: 'marteau', desc: 'Les charpentiers colmatent : +30 % de coque et de voilure en 6 s.', cooldown: 25 },
  seau: { id: 'seau', name: 'Pompes et seaux', price: { or: 120 }, key: '', cat: 'soin', icon: 'seau', desc: 'Éteint immédiatement un incendie à bord.', cooldown: 12 },
  poudre: { id: 'poudre', name: 'Poudre fine', price: { or: 400 }, key: '', cat: 'combat', icon: 'poudre', desc: '+25 % de dégâts pendant 20 s.', cooldown: 60, duration: 20 },
  reparation: { id: 'reparation', name: 'Réparation éclair', price: { or: 900 }, key: '', cat: 'soin', icon: 'croix', desc: 'Toute l\'équipe de charpentiers à l\'ouvrage : +25 % de coque immédiatement.', cooldown: 20, value: 0.25 },
  vitesse: { id: 'vitesse', name: 'Pierre des Alizés', price: { perles: 1 }, key: '', cat: 'soutien', icon: 'vent', desc: 'Un vent magique gonfle vos voiles : +50 % de vitesse pendant 15 s.', cooldown: 45, value: 0.5, duration: 15 },
  harpon_bronze: { id: 'harpon_bronze', name: 'Harpon de bronze', price: { or: 300 }, key: '', cat: 'combat', icon: 'harpon', desc: 'Lancé sur la cible (250 m) : 600 dégâts directs.', cooldown: 6, target: true, range: 250, value: 600 },
  harpon_argent: { id: 'harpon_argent', name: 'Harpon d\'argent', price: { perles: 1 }, key: '', cat: 'combat', icon: 'harpon', desc: 'Lancé sur la cible (280 m) : 1 600 dégâts directs.', cooldown: 6, target: true, range: 280, value: 1600 },
  harpon_or: { id: 'harpon_or', name: 'Harpon d\'or', price: { diamants: 1 }, key: '', cat: 'combat', icon: 'harpon', desc: 'Lancé sur la cible (320 m) : 4 500 dégâts directs.', cooldown: 6, target: true, range: 320, value: 4500 },
  feu_gregeois: { id: 'feu_gregeois', name: 'Feu grégeois', price: { perles: 2 }, key: '', cat: 'combat', icon: 'feu', desc: 'Le feu qui brûle sur l\'eau : 1 200 dégâts et un incendie de 15 s sur la cible.', cooldown: 30, target: true, range: 300, value: 1200, duration: 15 },
  brulot: { id: 'brulot', name: 'Brûlot', price: { diamants: 2 }, key: '', cat: 'combat', icon: 'brulot', desc: 'Un navire chargé de poudre lancé sur l\'ennemi : 10 % de sa coque et un violent incendie.', cooldown: 90, target: true, range: 350, value: 0.1, duration: 20 },
  bouclier: { id: 'bouclier', name: 'Bouclier d\'airain', price: { perles: 2 }, key: '', cat: 'soutien', icon: 'bouclier', desc: 'Plaques de bronze sur la coque : −40 % de dégâts reçus pendant 15 s.', cooldown: 60, value: 0.4, duration: 15 },
  corne: { id: 'corne', name: 'Corne de Neptune', price: { perles: 3 }, key: '', cat: 'combat', icon: 'corne', desc: 'Son appel fait trembler la mer : tous les ennemis à 350 m sont ralentis de moitié pendant 10 s.', cooldown: 60, range: 350, value: 0.5, duration: 10 },
  fumigene: { id: 'fumigene', name: 'Rideau de fumée', price: { perles: 1 }, key: '', cat: 'soutien', icon: 'fumee', desc: 'Les PNJ perdent votre trace pendant 8 s : idéal pour fuir ou réparer.', cooldown: 60, duration: 8 },
  lanterne: { id: 'lanterne', name: 'Lanterne de Saint-Elme', price: { diamants: 3 }, key: '', cat: 'soutien', icon: 'lanterne', desc: 'Vous et votre groupe à 600 m gagnez +50 % d\'XP et de points élite pendant 10 minutes.', cooldown: 600, value: 0.5, duration: 600, range: 600 },
  parchemin: { id: 'parchemin', name: 'Parchemin du Grand Navigateur', price: { diamants: 5 }, key: '', cat: 'tresor', icon: 'parchemin', desc: 'Expérience doublée pendant 30 minutes.', cooldown: 1800, value: 1, duration: 1800 },
  coffre_amiral: { id: 'coffre_amiral', name: 'Coffre de l\'Amiral', price: { perles: 20 }, key: '', cat: 'tresor', icon: 'coffre', desc: 'Un coffre scellé du sceau royal : or, diamants, canons de 60 livres ou mâts de Riga… au hasard.', cooldown: 1 },
};
export const CONSUMABLE_ORDER = Object.keys(CONSUMABLES) as ConsumableId[];
export const ITEM_CATS: { id: ItemCat; name: string }[] = [
  { id: 'soin', name: 'Soins et réparations' },
  { id: 'combat', name: 'Armes spéciales' },
  { id: 'soutien', name: 'Soutien' },
  { id: 'tresor', name: 'Trésors et parchemins' },
];

// --- Commerce ---------------------------------------------------------------
export type GoodId = 'vin' | 'sel' | 'toile' | 'bois' | 'epices' | 'rhum' | 'sucre' | 'cafe' | 'soie' | 'armes' | 'fourrures' | 'huile' | 'tabac' | 'the';
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
  // Ressources régionales
  fourrures: { id: 'fourrures', name: 'Fourrures du Nord', base: 140 },
  huile: { id: 'huile', name: 'Huile d\'olive du Levant', base: 80 },
  tabac: { id: 'tabac', name: 'Tabac des Amériques', base: 95 },
  the: { id: 'the', name: 'Thé et porcelaine de Chine', base: 220 },
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
