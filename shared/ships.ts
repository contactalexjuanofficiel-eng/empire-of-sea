// Catalogue des navires : 7 classes historiques et des bâtiments nommés d'après de vrais navires de la marine française.
// Source de vérité unique pour le client (affichage, modèles 3D) et le serveur (simulation, achats).
import { fitEffects, MAST_CAPACITY, type Fit } from './equipment.ts';

export type ShipClassId = 'corvette' | 'brick' | 'fregate' | 'fregate_lourde' | 'vaisseau' | 'trois_ponts' | 'amiral';
export type Rarity = 'commun' | 'peu_commun' | 'rare' | 'epique' | 'legendaire';
export type FlagStyle = 'royal' | 'tricolore' | 'imperial' | 'pirate' | 'anglais' | 'barbaresque' | 'spectre' | 'hollandais' | 'aucun';
export type MonsterKind = 'crocodile' | 'requin' | 'serpent' | 'kraken' | 'leviathan';

export interface ShipClass {
  id: ShipClassId;
  name: string;
  tier: number;
  /** Dimensions du modèle 3D (mètres). */
  length: number;
  beam: number;
  masts: number;
  gunDecks: number;
  /** Statistiques de base de la classe. */
  hp: number;
  speed: number; // m/s (vitesse « de jeu », accélérée par rapport au réel)
  turn: number; // rad/s à pleine vitesse
  accel: number; // m/s²
  reload: number; // s par bordée
  caliber: number; // multiplicateur de dégâts par canon
  range: number; // m
  cargo: number; // tonneaux
  armor: number; // réduction de dégâts 0..1
  desc: string;
}

export const SHIP_CLASSES: Record<ShipClassId, ShipClass> = {
  corvette: { id: 'corvette', name: 'Corvette', tier: 1, length: 30, beam: 8, masts: 2, gunDecks: 0, hp: 1000, speed: 19, turn: 0.62, accel: 3.2, reload: 5, caliber: 1, range: 300, cargo: 20, armor: 0, desc: 'Petit bâtiment rapide et maniable, idéal pour apprendre le métier de la mer.' },
  brick: { id: 'brick', name: 'Brick', tier: 2, length: 36, beam: 9.5, masts: 2, gunDecks: 0, hp: 1600, speed: 18.5, turn: 0.55, accel: 3, reload: 5.5, caliber: 1.1, range: 320, cargo: 35, armor: 0.04, desc: 'Deux mâts à phares carrés, coque renforcée : le chasseur des côtes.' },
  fregate: { id: 'fregate', name: 'Frégate', tier: 3, length: 46, beam: 12, masts: 3, gunDecks: 1, hp: 2800, speed: 18, turn: 0.46, accel: 2.6, reload: 6, caliber: 1.2, range: 340, cargo: 60, armor: 0.08, desc: 'L\'œil de l\'escadre : rapide, bien armée, endurante.' },
  fregate_lourde: { id: 'fregate_lourde', name: 'Frégate lourde', tier: 4, length: 52, beam: 13.5, masts: 3, gunDecks: 1, hp: 4200, speed: 17, turn: 0.4, accel: 2.3, reload: 6.5, caliber: 1.3, range: 355, cargo: 80, armor: 0.12, desc: 'Batterie de 24 livres et gaillards armés : une frégate qui ose défier les vaisseaux.' },
  vaisseau: { id: 'vaisseau', name: 'Vaisseau de ligne', tier: 5, length: 58, beam: 15, masts: 3, gunDecks: 2, hp: 6500, speed: 15.5, turn: 0.33, accel: 1.9, reload: 7.5, caliber: 1.45, range: 370, cargo: 120, armor: 0.16, desc: 'Le « 74 canons », colonne vertébrale de la ligne de bataille.' },
  trois_ponts: { id: 'trois_ponts', name: 'Trois-ponts', tier: 6, length: 64, beam: 17, masts: 3, gunDecks: 3, hp: 9500, speed: 14, turn: 0.27, accel: 1.6, reload: 8.5, caliber: 1.6, range: 385, cargo: 160, armor: 0.2, desc: 'Une forteresse flottante de plus de cent bouches à feu.' },
  amiral: { id: 'amiral', name: 'Navire amiral', tier: 7, length: 70, beam: 18.5, masts: 3, gunDecks: 3, hp: 13000, speed: 14.5, turn: 0.27, accel: 1.7, reload: 8.5, caliber: 1.8, range: 400, cargo: 200, armor: 0.24, desc: 'Le vaisseau qui porte la marque de l\'amiral. Sa seule vue fait plier les escadres.' },
};

export interface ShipLook {
  hull: number; // couleur de la coque
  stripe: number; // bandeau de la batterie
  trim: number; // dorures
  sail: number; // toile
  flag: FlagStyle;
  emblem?: boolean; // emblème peint sur la grand-voile
  glow?: number; // lueur spectrale (boss)
  monster?: MonsterKind; // créature marine (modèle 3D spécifique, attaque au contact)
}

export interface ShipDef {
  id: string;
  name: string;
  cls: ShipClassId;
  rarity: Rarity;
  level: number; // niveau de capitaine requis
  price: { or?: number; doublons?: number; perles?: number };
  canons: number; // nombre historique de bouches à feu
  /** Multiplicateurs propres au navire par rapport à sa classe. */
  mod: { hp?: number; speed?: number; turn?: number; reload?: number; cargo?: number; range?: number };
  look: ShipLook;
  history: string;
  /** Navire réservé aux PNJ (non achetable). */
  npcOnly?: boolean;
  /** Navire élite : points élite requis pour le débloquer (gratuit ensuite). */
  elite?: number;
}

const N = (d: ShipDef) => d;

export const SHIPS: ShipDef[] = [
  // I — Corvettes
  N({ id: 'bayonnaise', name: 'La Bayonnaise', cls: 'corvette', rarity: 'commun', level: 1, price: { or: 1000 }, canons: 20, mod: {}, look: { hull: 0x2a1d14, stripe: 0xc9a227, trim: 0xb8892b, sail: 0xe9e0c9, flag: 'tricolore' }, history: 'Corvette de 1793, célèbre pour avoir abordé et pris la frégate anglaise Ambuscade en 1798.' }),
  N({ id: 'mutine', name: 'La Mutine', cls: 'corvette', rarity: 'commun', level: 1, price: { or: 1500 }, canons: 18, mod: { hp: 0.88, speed: 1.08, turn: 1.08 }, look: { hull: 0x1d2633, stripe: 0xd8d2c0, trim: 0xb8892b, sail: 0xf0e8d4, flag: 'tricolore' }, history: 'Corvette fine et nerveuse, taillée pour la course et la poursuite.' }),
  N({ id: 'saint_michel', name: 'Le Saint-Michel', cls: 'corvette', rarity: 'peu_commun', level: 2, price: { or: 2500 }, canons: 22, mod: { hp: 1.12, speed: 0.95, turn: 0.95 }, look: { hull: 0x3a2716, stripe: 0x8f1d1d, trim: 0xd4a83a, sail: 0xe6dcc2, flag: 'royal' }, history: 'Nommé d\'après le vaisseau de Louis XIV ; coque épaisse et canons lourds pour sa taille.' }),
  // II — Bricks
  N({ id: 'cygne', name: 'Le Cygne', cls: 'brick', rarity: 'commun', level: 3, price: { or: 4500 }, canons: 18, mod: { speed: 1.04 }, look: { hull: 0x1c1c1f, stripe: 0xe8e2d0, trim: 0xb8892b, sail: 0xf2ead6, flag: 'tricolore' }, history: 'Brick de 1806 qui tint tête à plusieurs bâtiments anglais aux Antilles.' }),
  N({ id: 'duquesne', name: 'Le Duquesne', cls: 'brick', rarity: 'peu_commun', level: 4, price: { or: 7500 }, canons: 20, mod: { hp: 1.1, reload: 0.95 }, look: { hull: 0x2b1b12, stripe: 0x2d4a7a, trim: 0xd4a83a, sail: 0xe8dfc6, flag: 'royal' }, history: 'Hommage à Abraham Duquesne, vainqueur de Ruyter devant Agosta en 1676.' }),
  // III — Frégates
  N({ id: 'belle_poule', name: 'La Belle Poule', cls: 'fregate', rarity: 'commun', level: 7, price: { or: 16000 }, canons: 30, mod: {}, look: { hull: 0x23180f, stripe: 0xcfb46a, trim: 0xc99a2e, sail: 0xf1e9d3, flag: 'royal' }, history: 'Frégate de 1765 dont le combat de 1778 inspira une coiffure à la mode à la cour de Versailles.' }),
  N({ id: 'hermione', name: 'L\'Hermione', cls: 'fregate', rarity: 'rare', level: 9, price: { or: 26000, doublons: 40 }, canons: 32, mod: { speed: 1.06, turn: 1.05, hp: 1.05 }, look: { hull: 0x161a22, stripe: 0xc7a54a, trim: 0xe0b44a, sail: 0xf5efdc, flag: 'royal', emblem: true }, history: 'La frégate de La Fayette, qui porta en 1780 l\'aide de la France aux insurgés américains.' }),
  // IV — Frégates lourdes
  N({ id: 'formidable', name: 'Le Formidable', cls: 'fregate_lourde', rarity: 'rare', level: 12, price: { or: 42000, doublons: 60 }, canons: 44, mod: { hp: 1.05 }, look: { hull: 0x241812, stripe: 0x3a5f8f, trim: 0xd1a23a, sail: 0xece3cb, flag: 'tricolore' }, history: 'Son nom traverse trois siècles de marine française, de Louis XIV à la Révolution.' }),
  N({ id: 'suffren', name: 'Le Suffren', cls: 'fregate_lourde', rarity: 'epique', level: 14, price: { or: 58000, doublons: 120 }, canons: 48, mod: { speed: 1.05, reload: 0.92, hp: 1.08 }, look: { hull: 0x10131a, stripe: 0xb5302e, trim: 0xe6b84a, sail: 0xf3ead2, flag: 'royal', emblem: true }, history: 'Hommage au bailli de Suffren, terreur de la Royal Navy dans l\'océan Indien (1782-1783).' }),
  // V — Vaisseaux de ligne
  N({ id: 'redoutable', name: 'Le Redoutable', cls: 'vaisseau', rarity: 'rare', level: 16, price: { or: 90000, doublons: 150 }, canons: 74, mod: {}, look: { hull: 0x15120f, stripe: 0xcfae5a, trim: 0xd6a63c, sail: 0xeee5cd, flag: 'tricolore' }, history: 'À Trafalgar (1805), son équipage tint tête au Victory ; c\'est de sa hune que partit le tir qui frappa Nelson.' }),
  N({ id: 'duguay_trouin', name: 'Le Duguay-Trouin', cls: 'vaisseau', rarity: 'rare', level: 17, price: { or: 98000, doublons: 170 }, canons: 74, mod: { speed: 1.05, turn: 1.04 }, look: { hull: 0x1b140e, stripe: 0x2f4f7f, trim: 0xd6a63c, sail: 0xf0e7cf, flag: 'imperial' }, history: 'Hommage au corsaire malouin René Duguay-Trouin, qui prit Rio de Janeiro en 1711.' }),
  N({ id: 'vengeur', name: 'Le Vengeur du Peuple', cls: 'vaisseau', rarity: 'epique', level: 19, price: { or: 125000, doublons: 260 }, canons: 74, mod: { hp: 1.15, reload: 0.94 }, look: { hull: 0x101010, stripe: 0x9b1c1c, trim: 0xd9ad46, sail: 0xe7ddc4, flag: 'tricolore', emblem: true }, history: 'Au combat du 13 prairial an II (1794), il coula en refusant d\'amener ses couleurs.' }),
  N({ id: 'tonnant', name: 'Le Tonnant', cls: 'vaisseau', rarity: 'epique', level: 20, price: { or: 140000, doublons: 300 }, canons: 80, mod: { hp: 1.08, range: 1.05 }, look: { hull: 0x1a120b, stripe: 0xcda24b, trim: 0xe3b650, sail: 0xf2e9d1, flag: 'tricolore' }, history: 'Un « 80 canons » d\'Aboukir (1798), dont le capitaine Du Petit-Thouars combattit jusqu\'à la mort.' }),
  // VI — Trois-ponts
  N({ id: 'couronne', name: 'Le Couronne', cls: 'trois_ponts', rarity: 'epique', level: 23, price: { or: 210000, doublons: 450 }, canons: 100, mod: {}, look: { hull: 0x1c140c, stripe: 0x24406e, trim: 0xe6b84a, sail: 0xf0e6cc, flag: 'royal', emblem: true }, history: 'Le Couronne de 1636, premier grand vaisseau de Richelieu, fit l\'admiration de toute l\'Europe.' }),
  N({ id: 'royal_louis', name: 'Le Royal Louis', cls: 'trois_ponts', rarity: 'epique', level: 25, price: { or: 260000, doublons: 520 }, canons: 110, mod: { hp: 1.06, range: 1.04 }, look: { hull: 0x13100c, stripe: 0x1f3768, trim: 0xf0c25a, sail: 0xf3ead2, flag: 'royal', emblem: true }, history: 'Vaisseau de premier rang de Louis XIV, couvert de sculptures dorées par les ateliers de Toulon.' }),
  // VII — Navires amiraux
  N({ id: 'bucentaure', name: 'Le Bucentaure', cls: 'amiral', rarity: 'legendaire', level: 28, price: { or: 420000, doublons: 900, perles: 40 }, canons: 90, mod: { speed: 1.04, turn: 1.06, hp: 0.94 }, look: { hull: 0x0f0f12, stripe: 0xd2b25c, trim: 0xf2c75c, sail: 0xf2e9d0, flag: 'imperial', emblem: true }, history: 'Navire amiral de Villeneuve à Trafalgar, au cœur de la ligne franco-espagnole.' }),
  N({ id: 'napoleon', name: 'Le Napoléon', cls: 'amiral', rarity: 'legendaire', level: 30, price: { or: 480000, doublons: 1000, perles: 60 }, canons: 90, mod: { speed: 1.18, turn: 1.1, reload: 0.95 }, look: { hull: 0x0d0d0f, stripe: 0xe8e2d2, trim: 0xf2c75c, sail: 0xefe6cf, flag: 'imperial', emblem: true }, history: 'Premier vaisseau de ligne à hélice (1850) : une révolution qui rendait le vent facultatif.' }),
  N({ id: 'soleil_royal', name: 'Le Soleil Royal', cls: 'amiral', rarity: 'legendaire', level: 32, price: { or: 600000, doublons: 1300, perles: 90 }, canons: 104, mod: { hp: 1.12, reload: 0.95, range: 1.04 }, look: { hull: 0x101a33, stripe: 0xf0c25a, trim: 0xffd36a, sail: 0xf5edd8, flag: 'royal', emblem: true }, history: 'Le plus somptueux vaisseau du Roi-Soleil, navire amiral de Tourville à Béveziers (1690).' }),

  // Navires des PNJ (non achetables)
  N({ id: 'pirate_sloop', name: 'Sloop pirate', cls: 'corvette', rarity: 'commun', level: 1, price: {}, canons: 14, mod: { hp: 0.7, speed: 1.02 }, look: { hull: 0x2b2118, stripe: 0x3b2c1f, trim: 0x6b5a3a, sail: 0x8b8274, flag: 'pirate' }, history: '', npcOnly: true }),
  N({ id: 'pirate_brick', name: 'Brick pirate', cls: 'brick', rarity: 'commun', level: 3, price: {}, canons: 18, mod: { hp: 0.85 }, look: { hull: 0x241a12, stripe: 0x5a1a14, trim: 0x6b5a3a, sail: 0x7c7466, flag: 'pirate' }, history: '', npcOnly: true }),
  N({ id: 'anglais_fregate', name: 'Frégate anglaise', cls: 'fregate', rarity: 'commun', level: 6, price: {}, canons: 32, mod: { hp: 0.9 }, look: { hull: 0x1b1612, stripe: 0xd8b35a, trim: 0xb8892b, sail: 0xe9e2cf, flag: 'anglais' }, history: '', npcOnly: true }),
  N({ id: 'anglais_74', name: 'Vaisseau anglais', cls: 'vaisseau', rarity: 'commun', level: 14, price: {}, canons: 74, mod: { hp: 0.85 }, look: { hull: 0x1a1510, stripe: 0xd8b35a, trim: 0xb8892b, sail: 0xe9e2cf, flag: 'anglais' }, history: '', npcOnly: true }),
  N({ id: 'barbaresque', name: 'Chébec barbaresque', cls: 'brick', rarity: 'commun', level: 10, price: {}, canons: 24, mod: { speed: 1.1, turn: 1.1, hp: 1.3 }, look: { hull: 0x5a3b1f, stripe: 0x1e5a3a, trim: 0xc9a227, sail: 0xe6d8b0, flag: 'barbaresque' }, history: '', npcOnly: true }),
  N({ id: 'flibustier', name: 'Frégate flibustière', cls: 'fregate_lourde', rarity: 'commun', level: 18, price: {}, canons: 40, mod: { hp: 0.9 }, look: { hull: 0x1f1712, stripe: 0x6e1b1b, trim: 0x6b5a3a, sail: 0x6f675a, flag: 'pirate' }, history: '', npcOnly: true }),
  N({ id: 'anglais_3ponts', name: 'Trois-ponts anglais', cls: 'trois_ponts', rarity: 'commun', level: 24, price: {}, canons: 100, mod: { hp: 0.85 }, look: { hull: 0x1a1510, stripe: 0xd8b35a, trim: 0xc9a227, sail: 0xe9e2cf, flag: 'anglais' }, history: '', npcOnly: true }),
  N({ id: 'corsaire_amiral', name: 'Vaisseau amiral pirate', cls: 'amiral', rarity: 'commun', level: 30, price: {}, canons: 96, mod: { hp: 0.8, speed: 1.05 }, look: { hull: 0x140e0a, stripe: 0x6e1b1b, trim: 0x8a6a3a, sail: 0x5f574a, flag: 'pirate' }, history: '', npcOnly: true }),
  // Autres PNJ
  N({ id: 'chasse_maree', name: 'Chasse-marée contrebandier', cls: 'corvette', rarity: 'commun', level: 2, price: {}, canons: 10, mod: { hp: 0.6, speed: 1.15, turn: 1.15 }, look: { hull: 0x3a2a1a, stripe: 0x2a3a2a, trim: 0x6b5a3a, sail: 0xa08060, flag: 'pirate' }, history: '', npcOnly: true }),
  N({ id: 'hollandais_fregate', name: 'Frégate hollandaise', cls: 'fregate', rarity: 'commun', level: 8, price: {}, canons: 30, mod: { hp: 0.95 }, look: { hull: 0x2a1e14, stripe: 0xd07a20, trim: 0xb8892b, sail: 0xe8e0c8, flag: 'hollandais' }, history: '', npcOnly: true }),
  N({ id: 'galion_pirate', name: 'Galion des Frères de la Côte', cls: 'fregate_lourde', rarity: 'commun', level: 15, price: {}, canons: 44, mod: { hp: 1.05, speed: 0.92 }, look: { hull: 0x3a2412, stripe: 0xc9a227, trim: 0xd4a83a, sail: 0x4a4038, flag: 'pirate' }, history: '', npcOnly: true }),
  // Monstres marins (attaque au contact, pas de canons)
  N({ id: 'crocodile', name: 'Crocodile géant', cls: 'corvette', rarity: 'commun', level: 2, price: {}, canons: 0, mod: { hp: 0.55, speed: 0.9, turn: 1.3 }, look: { hull: 0x3d4a22, stripe: 0x2a3418, trim: 0xc9c08a, sail: 0, flag: 'aucun', monster: 'crocodile' }, history: '', npcOnly: true }),
  N({ id: 'requin', name: 'Requin-marteau géant', cls: 'corvette', rarity: 'commun', level: 6, price: {}, canons: 0, mod: { hp: 0.8, speed: 1.2, turn: 1.4 }, look: { hull: 0x5a6670, stripe: 0xd8dde0, trim: 0x22262a, sail: 0, flag: 'aucun', monster: 'requin' }, history: '', npcOnly: true }),
  N({ id: 'serpent', name: 'Serpent de mer', cls: 'brick', rarity: 'commun', level: 12, price: {}, canons: 0, mod: { hp: 1.4, speed: 1.05, turn: 1.3 }, look: { hull: 0x1f5a4a, stripe: 0xc8e070, trim: 0xff5030, sail: 0, flag: 'aucun', monster: 'serpent' }, history: '', npcOnly: true }),
  N({ id: 'kraken', name: 'Kraken', cls: 'vaisseau', rarity: 'commun', level: 22, price: {}, canons: 0, mod: { hp: 1.1, speed: 0.6, turn: 1.5 }, look: { hull: 0x6a2a3a, stripe: 0xd88a8a, trim: 0xffe0a0, sail: 0, flag: 'aucun', monster: 'kraken' }, history: '', npcOnly: true }),
  N({ id: 'leviathan', name: 'Léviathan', cls: 'trois_ponts', rarity: 'commun', level: 32, price: {}, canons: 0, mod: { hp: 1.2, speed: 0.85, turn: 1.2 }, look: { hull: 0x1a2a40, stripe: 0x6a8ab0, trim: 0x9fe8ff, sail: 0, flag: 'aucun', monster: 'leviathan', glow: 0x2a6aff }, history: '', npcOnly: true }),
  // Navires élites : débloqués avec les points élite (gagnés surtout en tirant des boulets de perle ou de diamant)
  N({ id: 'aigle_blanc', name: 'L\'Aigle Blanc', cls: 'fregate', rarity: 'epique', level: 1, price: {}, canons: 36, mod: { hp: 1.25, speed: 1.08, turn: 1.1 }, look: { hull: 0xe8e4d8, stripe: 0xc9a227, trim: 0xf2c75c, sail: 0xffffff, flag: 'royal', emblem: true }, history: 'Frégate d\'apparat entièrement peinte de blanc et d\'or, offerte aux capitaines d\'élite.', elite: 20000 }),
  N({ id: 'dragon_vert', name: 'Le Dragon Vert', cls: 'fregate_lourde', rarity: 'epique', level: 1, price: {}, canons: 48, mod: { hp: 1.3, speed: 1.06 }, look: { hull: 0x1e5a2a, stripe: 0x9fe070, trim: 0xd4e08a, sail: 0x8ad070, flag: 'royal', emblem: true }, history: 'Coque verte et voiles émeraude : on dit qu\'il porte chance aux corsaires de Saint-Malo.', elite: 60000 }),
  N({ id: 'salamandre', name: 'La Salamandre d\'Or', cls: 'vaisseau', rarity: 'epique', level: 1, price: {}, canons: 80, mod: { hp: 1.25, reload: 0.9 }, look: { hull: 0xd08a20, stripe: 0x6a3a10, trim: 0xffd36a, sail: 0xf0b050, flag: 'royal', emblem: true }, history: 'Un 80 canons couleur de braise, emblème de François Ier.', elite: 150000 }),
  N({ id: 'corsaire_noir', name: 'Le Corsaire Noir', cls: 'vaisseau', rarity: 'legendaire', level: 1, price: {}, canons: 84, mod: { hp: 1.3, speed: 1.1, turn: 1.08 }, look: { hull: 0x0c0c0e, stripe: 0xf0d040, trim: 0xf0d040, sail: 0x1a1a1a, flag: 'royal', emblem: true }, history: 'Voiles noires frappées de lys d\'or : la terreur des convois anglais.', elite: 350000 }),
  N({ id: 'lys_argent', name: 'Le Lys d\'Argent', cls: 'trois_ponts', rarity: 'legendaire', level: 1, price: {}, canons: 110, mod: { hp: 1.3, range: 1.06 }, look: { hull: 0xb8c0c8, stripe: 0x2a3a5a, trim: 0xf0f4ff, sail: 0xe8eef8, flag: 'royal', emblem: true }, history: 'Trois-ponts plaqué d\'argent, vaisseau de parade de la Marine royale.', elite: 700000 }),
  N({ id: 'licorne', name: 'La Licorne Écarlate', cls: 'trois_ponts', rarity: 'legendaire', level: 1, price: {}, canons: 116, mod: { hp: 1.35, reload: 0.9, speed: 1.06 }, look: { hull: 0x7a1010, stripe: 0x101010, trim: 0xf2c75c, sail: 0xd03020, flag: 'royal', emblem: true }, history: 'Hommage aux nombreuses Licorne de la Marine royale : coque et voiles rouge sang.', elite: 1500000 }),
  N({ id: 'triton', name: 'Le Triton d\'Émeraude', cls: 'amiral', rarity: 'legendaire', level: 1, price: {}, canons: 120, mod: { hp: 1.35, speed: 1.12, turn: 1.1 }, look: { hull: 0x0e3a3a, stripe: 0x4fffc0, trim: 0xb0ffe0, sail: 0x9fe0d0, flag: 'royal', emblem: true, glow: 0x1a6a5a }, history: 'Navire amiral des abysses, à la coque luisante comme une écaille.', elite: 3000000 }),
  N({ id: 'etoile_roi', name: 'L\'Étoile du Roi', cls: 'amiral', rarity: 'legendaire', level: 1, price: {}, canons: 130, mod: { hp: 1.45, reload: 0.88, range: 1.08, speed: 1.08 }, look: { hull: 0x101a40, stripe: 0xffd36a, trim: 0xfff0b0, sail: 0xf8f0d0, flag: 'royal', emblem: true, glow: 0x3a3a10 }, history: 'Le chef-d\'œuvre ultime des arsenaux du Roi. Réservé aux plus grands amiraux.', elite: 6000000 }),
  N({ id: 'spectre', name: 'Le Spectre des Brumes', cls: 'trois_ponts', rarity: 'legendaire', level: 25, price: {}, canons: 120, mod: { hp: 6, speed: 0.85, reload: 0.8, range: 1.1 }, look: { hull: 0x0c1412, stripe: 0x1d3b33, trim: 0x4fffc0, sail: 0x5f7a70, flag: 'spectre', glow: 0x3dffb0 }, history: 'Un trois-ponts disparu corps et biens en 1709, qui revient quand le brouillard tombe.', npcOnly: true }),
];

export const SHIP_BY_ID: Record<string, ShipDef> = Object.fromEntries(SHIPS.map((s) => [s.id, s]));
export const PLAYER_SHIPS = SHIPS.filter((s) => !s.npcOnly && !s.elite);
export const ELITE_SHIPS = SHIPS.filter((s) => s.elite).sort((a, b) => a.elite! - b.elite!);
export const STARTER_SHIPS = ['bayonnaise', 'mutine', 'saint_michel'];

export const RARITY_LABEL: Record<Rarity, string> = {
  commun: 'Commun',
  peu_commun: 'Peu commun',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
};
export const RARITY_COLOR: Record<Rarity, string> = {
  commun: '#b9b2a2',
  peu_commun: '#6fbf73',
  rare: '#5aa6e8',
  epique: '#b57ce8',
  legendaire: '#f0b54a',
};

/** Améliorations installées sur un navire possédé (0 à 5 chacune). */
export interface ShipUpgrades { coque: number; voiles: number; canons: number; boulets: number }
export const NO_UPGRADES: ShipUpgrades = { coque: 0, voiles: 0, canons: 0, boulets: 0 };

export interface Skills { artillerie: number; navigation: number; charpenterie: number; commerce: number }
export const NO_SKILLS: Skills = { artillerie: 0, navigation: 0, charpenterie: 0, commerce: 0 };

/** Statistiques effectives d'un navire (classe × navire × améliorations × compétences). */
export interface ShipStats {
  hp: number;
  sailHp: number;
  speed: number;
  turn: number;
  accel: number;
  reload: number;
  range: number;
  cargo: number;
  armor: number;
  broadside: number; // dégâts totaux d'une bordée
  balls: number; // boulets visibles par bordée
  dispersion: number; // radians
  repair: number; // multiplicateur de réparation
  length: number;
  beam: number;
}

/** Bonus multiplicatifs venant du capitaine : grades, ponts forgés, capitaines recrutés, pont décoré. */
export interface StatBonus { hp?: number; dmg?: number; armor?: number; speed?: number; reload?: number; range?: number }

export function computeStats(def: ShipDef, up: ShipUpgrades = NO_UPGRADES, sk: Skills = NO_SKILLS, fit?: Fit, bonus: StatBonus = {}): ShipStats {
  const c = SHIP_CLASSES[def.cls];
  const m = def.mod;
  const eq = fitEffects(fit, def.canons, MAST_CAPACITY[def.cls]);
  const hp = c.hp * (m.hp ?? 1) * (1 + 0.08 * up.coque) * (1 + 0.03 * sk.charpenterie) * eq.hp * (1 + (bonus.hp ?? 0));
  const speed = c.speed * (m.speed ?? 1) * (1 + 0.04 * up.voiles) * (1 + 0.02 * sk.navigation) * eq.speed * (1 + (bonus.speed ?? 0));
  const turn = c.turn * (m.turn ?? 1) * (1 + 0.05 * up.voiles) * (1 + 0.03 * sk.navigation);
  const reload = c.reload * (m.reload ?? 1) * (1 - 0.04 * up.canons) * eq.reload * (1 - (bonus.reload ?? 0));
  const range = c.range * (m.range ?? 1) * (1 + 0.05 * up.boulets) * eq.range * (1 + (bonus.range ?? 0));
  const broadside = (def.canons / 2) * 14 * c.caliber * (1 + 0.07 * up.canons) * (1 + 0.03 * sk.artillerie) * eq.damage * (1 + (bonus.dmg ?? 0));
  return {
    hp: Math.round(hp),
    sailHp: Math.round(hp * 0.5),
    speed,
    turn,
    accel: c.accel,
    reload,
    range,
    cargo: Math.round(c.cargo * (m.cargo ?? 1)),
    armor: Math.min(0.6, c.armor + 0.02 * up.coque + (bonus.armor ?? 0)),
    broadside,
    balls: Math.min(14, Math.round(4 + def.canons / 10)),
    dispersion: 0.05 * (1 - 0.1 * up.boulets),
    repair: 1 + 0.1 * sk.charpenterie,
    length: c.length,
    beam: c.beam,
  };
}
