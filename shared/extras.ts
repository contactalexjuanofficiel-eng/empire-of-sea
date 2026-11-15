// Systèmes de progression secondaires : grades de tir et de pêche, pêche, ponts décorés,
// forge du matelot de pont, capitaines recrutés, points élite. Partagé client/serveur.
import type { Profile } from './protocol.ts';
import type { StatBonus } from './ships.ts';

type Price = { or?: number; perles?: number; diamants?: number };

// --- Grades -------------------------------------------------------------------
export const SHOOT_RANKS = [
  { min: 0, name: 'Canonnier novice' },
  { min: 2000, name: 'Canonnier de 3e classe' },
  { min: 8000, name: 'Canonnier de 2e classe' },
  { min: 25000, name: 'Canonnier de 1re classe' },
  { min: 70000, name: 'Chef de pièce' },
  { min: 180000, name: 'Maître canonnier' },
  { min: 450000, name: 'Capitaine d\'artillerie' },
  { min: 1000000, name: 'Maître artilleur' },
  { min: 2500000, name: 'Artilleur royal' },
  { min: 6000000, name: 'Foudre de guerre' },
];
export const FISH_RANKS = [
  { min: 0, name: 'Mousse pêcheur' },
  { min: 300, name: 'Pêcheur' },
  { min: 1200, name: 'Pêcheur confirmé' },
  { min: 4000, name: 'Maître pêcheur' },
  { min: 12000, name: 'Pêcheur du Roi' },
  { min: 35000, name: 'Pêcheur légendaire' },
];
export function rankIndex(ranks: { min: number }[], xp: number) {
  let i = 0;
  for (let k = 0; k < ranks.length; k++) if (xp >= ranks[k].min) i = k;
  return i;
}
/** Points de grade de tir : dégâts sur les PNJ ×0,1 ; sur les joueurs ×0,5 et +2 000 par navire coulé. */
export const SHOOT_XP = { npc: 0.1, player: 0.5, playerKill: 2000 };

// --- Pêche ----------------------------------------------------------------------
export type FishId = 'hareng' | 'maquereau' | 'bar' | 'daurade' | 'thon' | 'espadon' | 'merou' | 'huitre';
export interface FishDef { id: FishId; name: string; xp: number; price: number; minTier: number; weight: number }
export const FISH: Record<FishId, FishDef> = {
  hareng: { id: 'hareng', name: 'Hareng', xp: 4, price: 25, minTier: 1, weight: 30 },
  maquereau: { id: 'maquereau', name: 'Maquereau', xp: 6, price: 40, minTier: 1, weight: 24 },
  bar: { id: 'bar', name: 'Bar de ligne', xp: 10, price: 80, minTier: 1, weight: 16 },
  daurade: { id: 'daurade', name: 'Daurade royale', xp: 14, price: 120, minTier: 2, weight: 12 },
  thon: { id: 'thon', name: 'Thon rouge', xp: 25, price: 260, minTier: 3, weight: 8 },
  espadon: { id: 'espadon', name: 'Espadon', xp: 45, price: 520, minTier: 5, weight: 5 },
  merou: { id: 'merou', name: 'Mérou géant', xp: 80, price: 1100, minTier: 7, weight: 3 },
  huitre: { id: 'huitre', name: 'Huître perlière', xp: 60, price: 0, minTier: 1, weight: 2 },
};
export const FISH_ORDER = Object.keys(FISH) as FishId[];
/** Secondes entre deux prises (diminue avec le grade de pêche). */
export const fishInterval = (grade: number) => Math.max(3, 8 - grade * 0.8);

// --- Ponts décorés --------------------------------------------------------------
export type SkinId = 'dore' | 'bleu';
export interface SkinDef { id: SkinId; name: string; price: Price; deck: number; stripe: number; trim: number; sail: number; hp: number; desc: string }
export const SKINS: Record<SkinId, SkinDef> = {
  dore: { id: 'dore', name: 'Pont doré', price: { diamants: 25 }, deck: 0xe0b440, stripe: 0xf2c440, trim: 0xffe08a, sail: 0xfff2c0, hp: 0.03, desc: 'Pont et préceintes à la feuille d\'or, voiles crème. +3 % de coque.' },
  bleu: { id: 'bleu', name: 'Pont bleu royal', price: { perles: 120 }, deck: 0x2a5aa8, stripe: 0x3a7ad0, trim: 0x9fd0ff, sail: 0xe0ecff, hp: 0.03, desc: 'Le bleu de France sur tout le navire. +3 % de coque.' },
};

// --- Forge du matelot de pont --------------------------------------------------
export interface ForgeSlot { n: number; ferraille: number; or: number; chance: number; bonus: StatBonus; label: string }
export const FORGE: ForgeSlot[] = [
  { n: 1, ferraille: 40, or: 2000, chance: 0.75, bonus: { hp: 0.04 }, label: '+4 % de coque' },
  { n: 2, ferraille: 70, or: 4000, chance: 0.68, bonus: { hp: 0.04 }, label: '+4 % de coque' },
  { n: 3, ferraille: 110, or: 7000, chance: 0.6, bonus: { armor: 0.02 }, label: '+2 % de blindage' },
  { n: 4, ferraille: 160, or: 11000, chance: 0.54, bonus: { armor: 0.02 }, label: '+2 % de blindage' },
  { n: 5, ferraille: 230, or: 16000, chance: 0.47, bonus: { dmg: 0.04 }, label: '+4 % de dégâts' },
  { n: 6, ferraille: 320, or: 24000, chance: 0.41, bonus: { dmg: 0.04 }, label: '+4 % de dégâts' },
  { n: 7, ferraille: 440, or: 35000, chance: 0.35, bonus: { reload: 0.03 }, label: '−3 % de rechargement' },
  { n: 8, ferraille: 600, or: 50000, chance: 0.3, bonus: { reload: 0.03, speed: 0.03 }, label: '−3 % de rechargement, +3 % de vitesse' },
];

// --- Capitaines ------------------------------------------------------------------
export type CaptainCat = 'offensif' | 'defensif' | 'economique' | 'special';
export interface Econ { gold?: number; xp?: number; elite?: number; fish?: number }
export interface CaptainDef { id: string; name: string; cat: CaptainCat; price: Price; bonus: StatBonus; econ: Econ; desc: string; icon: string }
export const CAPTAIN_CATS: { id: CaptainCat; name: string }[] = [
  { id: 'offensif', name: 'Capitaines offensifs' },
  { id: 'defensif', name: 'Capitaines défensifs' },
  { id: 'economique', name: 'Capitaines économiques' },
  { id: 'special', name: 'Capitaines spéciaux' },
];
export const CAPTAINS: CaptainDef[] = [
  { id: 'jean_bart', name: 'Jean Bart', cat: 'offensif', price: { or: 25000 }, bonus: { dmg: 0.08 }, econ: {}, icon: '⚔', desc: 'Le corsaire de Dunkerque : +8 % de dégâts.' },
  { id: 'surcouf', name: 'Robert Surcouf', cat: 'offensif', price: { perles: 40 }, bonus: { dmg: 0.12, range: 0.03 }, econ: {}, icon: '☠', desc: 'Le roi des corsaires : +12 % de dégâts, +3 % de portée.' },
  { id: 'tourville', name: 'Comte de Tourville', cat: 'defensif', price: { or: 25000 }, bonus: { hp: 0.1 }, econ: {}, icon: '⛨', desc: 'Vainqueur de Béveziers : +10 % de coque.' },
  { id: 'duquesne_c', name: 'Abraham Duquesne', cat: 'defensif', price: { perles: 40 }, bonus: { hp: 0.06, armor: 0.05 }, econ: {}, icon: '⚓', desc: 'Le vieux lion d\'Agosta : +6 % de coque, +5 % de blindage.' },
  { id: 'cassard', name: 'Jacques Cassard', cat: 'economique', price: { or: 20000 }, bonus: {}, econ: { gold: 0.15 }, icon: '⚖', desc: 'Corsaire nantais au sens des affaires : +15 % d\'or gagné.' },
  { id: 'bougainville', name: 'Louis-Antoine de Bougainville', cat: 'economique', price: { perles: 30 }, bonus: {}, econ: { xp: 0.15 }, icon: '✦', desc: 'Le grand navigateur : +15 % d\'expérience.' },
  { id: 'anne', name: 'Anne Dieu-le-Veut', cat: 'special', price: { diamants: 15 }, bonus: { reload: 0.08 }, econ: {}, icon: '♛', desc: 'La flibustière de la Tortue : −8 % de rechargement.' },
  { id: 'laperouse', name: 'Jean-François de La Pérouse', cat: 'special', price: { diamants: 10 }, bonus: { speed: 0.05 }, econ: { fish: 0.25 }, icon: '☸', desc: 'Explorateur des mers du Sud : +5 % de vitesse, pêche +25 %.' },
  { id: 'suffren_c', name: 'Bailli de Suffren', cat: 'special', price: { diamants: 20 }, bonus: { dmg: 0.03 }, econ: { elite: 0.3 }, icon: '✠', desc: 'Le terrible amiral : +30 % de points élite, +3 % de dégâts.' },
];
export const CAPTAIN_BY_ID: Record<string, CaptainDef> = Object.fromEntries(CAPTAINS.map((c) => [c.id, c]));

// --- Bonus cumulés d'un capitaine ---------------------------------------------
export function playerBonus(p: Pick<Profile, 'shootXp' | 'forge' | 'skin' | 'captainsActive'>): { stat: StatBonus; econ: Required<Econ> } {
  const stat: Required<StatBonus> = { hp: 0, dmg: 0, armor: 0, speed: 0, reload: 0, range: 0 };
  const econ: Required<Econ> = { gold: 0, xp: 0, elite: 0, fish: 0 };
  const add = (b: StatBonus) => { for (const k of Object.keys(b) as (keyof StatBonus)[]) stat[k] += b[k] ?? 0; };
  stat.dmg += 0.01 * rankIndex(SHOOT_RANKS, p.shootXp ?? 0); // +1 % de dégâts par grade de tir
  (p.forge ?? []).forEach((ok, i) => { if (ok && FORGE[i]) add(FORGE[i].bonus); });
  if (p.skin && SKINS[p.skin as SkinId]) stat.hp += SKINS[p.skin as SkinId].hp;
  for (const id of Object.values(p.captainsActive ?? {})) {
    const c = id ? CAPTAIN_BY_ID[id] : undefined;
    if (!c) continue;
    add(c.bonus);
    for (const k of Object.keys(c.econ) as (keyof Econ)[]) econ[k] += c.econ[k] ?? 0;
  }
  return { stat, econ };
}

/** Points élite : 10 % des dégâts infligés, multipliés selon le boulet (perle ×5, diamant ×12). */
export const ELITE_RATE = 0.1;

// --- Missions quotidiennes et missions de niveau --------------------------------
export type DailyKind = 'degats' | 'pirates' | 'tresors' | 'navires' | 'flibustiers' | 'monstres';
export interface DailyDef { id: DailyKind; name: string; desc: string; goal: (tier: number) => number; reward: (tier: number) => { or: number; perles?: number; diamants?: number; xp: number } }
/** Nombre de missions quotidiennes actives à la fois (passera à 3 avec l'espace premium). */
export const DAILY_SLOTS = 1;
export const DAILY_COOLDOWN_H = 12;
export const DAILY: DailyDef[] = [
  { id: 'degats', name: 'Infliger des dégâts autour de vous', desc: 'Infligez {n} dégâts aux navires et créatures de la carte.', goal: (t) => 20000 * t * t, reward: (t) => ({ or: 8000 * t, perles: 2 + t, xp: 1500 * t }) },
  { id: 'pirates', name: 'Réprimer la rébellion', desc: 'Coulez {n} navires pirates.', goal: (t) => 6 + t * 2, reward: (t) => ({ or: 6000 * t, perles: 2 + t, xp: 1200 * t }) },
  { id: 'tresors', name: 'Trouver les trésors perdus', desc: 'Ouvrez {n} coffres ou trésors d\'épaves.', goal: () => 8, reward: (t) => ({ or: 5000 * t, perles: 3 + t, xp: 1000 * t }) },
  { id: 'navires', name: 'La sécurité des mers est entre vos mains', desc: 'Coulez {n} ennemis, quels qu\'ils soient.', goal: (t) => 10 + t * 3, reward: (t) => ({ or: 9000 * t, perles: 3 + t, xp: 2000 * t }) },
  { id: 'flibustiers', name: 'Le gang du Baron', desc: 'Coulez {n} navires de la Royal Navy, flibustiers ou galions.', goal: (t) => 5 + t * 2, reward: (t) => ({ or: 10000 * t, diamants: 1 + Math.floor(t / 3), xp: 2200 * t }) },
  { id: 'monstres', name: 'Chasseur de monstres', desc: 'Abattez {n} monstres marins.', goal: (t) => 4 + t, reward: (t) => ({ or: 7000 * t, diamants: 1 + Math.floor(t / 4), xp: 1800 * t }) },
];
export const DAILY_BY_ID = Object.fromEntries(DAILY.map((d) => [d.id, d])) as Record<DailyKind, DailyDef>;

/** Mission de niveau : à chaque niveau, couler un nombre d'ennemis de niveau suffisant. */
export function levelMission(level: number) {
  return { goal: 5 + Math.ceil(level / 2), minLevel: Math.max(1, level - 3), xpShare: 0.45, or: 1500 * level };
}
