// Ère moderne : 25 navires français en 5 catégories (voiliers, pêche, vedettes, patrouilleurs, frégates),
// inspirés de bâtiments réels sans reproduire de modèles commerciaux. Chaque navire a sa silhouette (paramètres
// du générateur 3D) et ses caractéristiques propres. Utilisables uniquement sur les cartes de l'ère moderne.
import type { ShipDef } from './ships.ts';

export type ModernCategory = 'voiliers' | 'peche' | 'vedettes' | 'patrouilleurs' | 'fregates';
export const MODERN_CATEGORIES: { id: ModernCategory; name: string; cls: ShipDef['cls'] }[] = [
  { id: 'voiliers', name: 'Voiliers', cls: 'voilier' },
  { id: 'peche', name: 'Bateaux de pêche', cls: 'peche' },
  { id: 'vedettes', name: 'Vedettes rapides', cls: 'vedette' },
  { id: 'patrouilleurs', name: 'Patrouilleurs', cls: 'patrouilleur' },
  { id: 'fregates', name: 'Frégates militaires', cls: 'fregate_moderne' },
];

/** Paramètres du générateur 3D des navires à moteur. */
export interface ModernSpec {
  type: 'peche' | 'vedette' | 'patrouilleur' | 'fregate';
  variant: string;
  hull: number; // coque
  top: number; // superstructure
  accent: number; // liseré, cheminée, détails
  deck: number;
  number?: string; // numéro de coque peint
  label?: string; // inscription sur la coque
}

const M = (d: Omit<ShipDef, 'rarity' | 'mod' | 'history' | 'look'> & Partial<ShipDef>): ShipDef => ({
  rarity: 'commun', mod: {}, history: '', era: 'moderne',
  // Navires à moteur : couleurs dérivées de leur fiche 3D (affichage, mini-carte).
  look: d.modern ? { hull: d.modern.hull, stripe: d.modern.accent, trim: d.modern.accent, sail: d.modern.top, flag: 'tricolore' } : undefined,
  ...d,
}) as ShipDef;
const look = (hull: number, stripe: number, trim: number, sail: number) => ({ hull, stripe, trim, sail, flag: 'tricolore' as const });

export const MODERN_SHIPS: ShipDef[] = [
  // --- Voiliers (générateur de voiliers, gréements différents)
  M({ id: 'm_belem', name: 'Le Belem', cls: 'voilier', rarity: 'rare', level: 1, price: { or: 3000 }, canons: 6, size: { L: 52, B: 8.8 }, rig: 'barque', noPorts: true, mod: { hp: 1.05 }, look: look(0xf2f0ea, 0x1a2a3a, 0xc9a24a, 0xf0e8d4), history: 'Trois-mâts barque de 1896, le plus vieux grand voilier français encore en navigation.' }),
  M({ id: 'm_belle_poule', name: 'La Belle Poule', cls: 'voilier', level: 1, price: { or: 2000 }, canons: 4, size: { L: 37, B: 7.4 }, rig: 'goelette', noPorts: true, mod: { speed: 1.08, turn: 1.15, hp: 0.75 }, look: look(0x14161c, 0xf2f0ea, 0xc9a24a, 0xf4ecd8), history: 'Goélette-école de la Marine nationale (1932), sœur jumelle de L\'Étoile.' }),
  M({ id: 'm_francais', name: 'Le Français', cls: 'voilier', rarity: 'peu_commun', level: 2, price: { or: 4000 }, canons: 8, size: { L: 46, B: 8 }, rig: 'barque', noPorts: true, mod: { hp: 1.1, speed: 0.95, cargo: 1.4 }, look: look(0x22201c, 0xd8c8a0, 0xb8892b, 0xe8dcc4), history: 'Le trois-mâts polaire du commandant Charcot, renforcé pour les glaces de l\'Antarctique (1903).' }),
  M({ id: 'm_mutin', name: 'Le Mutin', cls: 'voilier', level: 1, price: { or: 1500 }, canons: 2, size: { L: 33, B: 6.5 }, rig: 'dundee', noPorts: true, mod: { hp: 0.6, speed: 1.05, turn: 1.25 }, look: look(0x3a2a1c, 0x8a1c1c, 0xb8892b, 0xc89a6a), history: 'Dundee de 1927 aux voiles tannées, le plus ancien bâtiment en service de la Marine nationale.' }),
  M({ id: 'm_hermione', name: 'L\'Hermione', cls: 'voilier', rarity: 'epique', level: 3, price: { or: 9000 }, canons: 26, size: { L: 65, B: 11.2 }, rig: 'carre', mod: { hp: 1.5, speed: 0.95, turn: 0.85 }, look: { ...look(0x161a22, 0xc7a54a, 0xe0b44a, 0xf5efdc), flag: 'royal', emblem: true }, history: 'Réplique fidèle de la frégate de La Fayette, lancée à Rochefort et partie pour l\'Amérique en 2015.' }),
  // --- Bateaux de pêche
  M({ id: 'm_chalutier', name: 'Chalutier breton', cls: 'peche', level: 1, price: { or: 1200 }, canons: 4, size: { L: 24, B: 7.5 }, modern: { type: 'peche', variant: 'chalutier', hull: 0x1f4fa0, top: 0xf2f0ea, accent: 0xd03020, deck: 0x6a7480, number: 'GV 812', label: 'TI BREIZH' }, history: 'Chalutier de pêche côtière de Guilvinec, coque bleue et timonerie blanche.' }),
  M({ id: 'm_fileyeur', name: 'Fileyeur', cls: 'peche', level: 1, price: { or: 1000 }, canons: 3, size: { L: 18, B: 6 }, mod: { turn: 1.2, hp: 0.8 }, modern: { type: 'peche', variant: 'fileyeur', hull: 0xd8d8d0, top: 0xf2f0ea, accent: 0x1f8a4a, deck: 0x6a7480, number: 'CC 451', label: 'AR MOR' }, history: 'Petit fileyeur de Concarneau, avec son vire-filet et ses bouées.' }),
  M({ id: 'm_hauturier', name: 'Chalutier hauturier', cls: 'peche', rarity: 'peu_commun', level: 3, price: { or: 3500 }, canons: 6, size: { L: 42, B: 10 }, mod: { hp: 1.5, speed: 1.05, cargo: 2 }, modern: { type: 'peche', variant: 'hauturier', hull: 0xb02020, top: 0xf2f0ea, accent: 0x1a1a1a, deck: 0x5a646e, number: 'LO 707', label: 'GRAND LARGE' }, history: 'Chalutier de grand large à rampe arrière, capable de rester des semaines en mer.' }),
  M({ id: 'm_caseyeur', name: 'Caseyeur', cls: 'peche', level: 1, price: { or: 900 }, canons: 3, size: { L: 15, B: 5.6 }, mod: { hp: 0.7, turn: 1.25 }, modern: { type: 'peche', variant: 'caseyeur', hull: 0xf0c020, top: 0xf2f0ea, accent: 0x2a5ab0, deck: 0x6a7480, number: 'BR 233', label: 'HOMARD BLEU' }, history: 'Caseyeur de Roscoff, chargé de casiers à homards et à tourteaux.' }),
  M({ id: 'm_thonier', name: 'Thonier senneur', cls: 'peche', rarity: 'rare', level: 4, price: { or: 5000 }, canons: 8, size: { L: 48, B: 11 }, mod: { hp: 1.6, cargo: 2.4, speed: 1.08 }, modern: { type: 'peche', variant: 'thonier', hull: 0x1a5a3a, top: 0xf2f0ea, accent: 0xe0b020, deck: 0x5a646e, number: 'CC 999', label: 'ALBACORE' }, history: 'Thonier senneur de l\'océan Indien, avec sa vigie, son power-block et son canot de senne.' }),
  // --- Vedettes
  M({ id: 'm_vedette_rapide', name: 'Vedette rapide', cls: 'vedette', level: 1, price: { or: 1500 }, canons: 6, size: { L: 14, B: 4.2 }, mod: { speed: 1.1, turn: 1.1 }, modern: { type: 'vedette', variant: 'rapide', hull: 0x2a2e36, top: 0xe8e8e8, accent: 0xd02020, deck: 0x3a3e46, number: 'V 01' }, history: 'Coque en V profond et deux moteurs hors-bord : la plus rapide de la flotte.' }),
  M({ id: 'm_vedette_surveillance', name: 'Vedette de surveillance', cls: 'vedette', level: 2, price: { or: 2500 }, canons: 8, size: { L: 20, B: 5.2 }, mod: { hp: 1.2 }, modern: { type: 'vedette', variant: 'surveillance', hull: 0x8a949e, top: 0xd8dde2, accent: 0x1a3a7a, deck: 0x5a646e, number: 'P 712', label: 'MARINE NATIONALE' }, history: 'Vedette côtière à cabine vitrée et radar, pour la surveillance des approches.' }),
  M({ id: 'm_vedette_gardecote', name: 'Vedette garde-côte', cls: 'vedette', rarity: 'peu_commun', level: 3, price: { or: 3500 }, canons: 10, size: { L: 24, B: 5.8 }, mod: { hp: 1.35, speed: 0.95 }, modern: { type: 'vedette', variant: 'gardecote', hull: 0x1f3f8a, top: 0xf2f2f2, accent: 0xd02020, deck: 0x4a5462, number: 'GC 38', label: 'GARDE-CÔTES' }, history: 'Vedette des garde-côtes, bandes tricolores en biais sur l\'étrave.' }),
  M({ id: 'm_vedette_interception', name: 'Vedette d\'interception', cls: 'vedette', rarity: 'rare', level: 4, price: { or: 5000 }, canons: 12, size: { L: 18, B: 4.6 }, mod: { speed: 1.2, turn: 1.15, hp: 0.95 }, modern: { type: 'vedette', variant: 'interception', hull: 0x1c1e22, top: 0x2a2e36, accent: 0x6a7a8a, deck: 0x22262c, number: 'I 07' }, history: 'Intercepteur furtif à coque noire, quatre moteurs, pour rattraper les contrebandiers.' }),
  M({ id: 'm_vedette_sauvetage', name: 'Vedette de sauvetage', cls: 'vedette', level: 2, price: { or: 2500 }, canons: 4, size: { L: 17, B: 5.4 }, mod: { hp: 1.3, turn: 1.1 }, modern: { type: 'vedette', variant: 'sauvetage', hull: 0x1f3f8a, top: 0xf07020, accent: 0xf2f2f2, deck: 0x3a4452, number: 'SNS 061', label: 'SAUVETAGE EN MER' }, history: 'Canot tous temps auto-redressable, orange et bleu, prêt à sortir par toutes les mers.' }),
  // --- Patrouilleurs
  M({ id: 'm_aramis', name: 'Patrouilleur Aramis', cls: 'patrouilleur', level: 4, price: { or: 8000 }, canons: 22, size: { L: 32, B: 7.5 }, mod: { hp: 0.7, speed: 1.08, turn: 1.2 }, modern: { type: 'patrouilleur', variant: 'aramis', hull: 0x8a949e, top: 0x9aa4ae, accent: 0x2a2e36, deck: 0x5a646e, number: 'P 776' }, history: 'Patrouilleur portuaire de la gendarmerie maritime, compact et manœuvrant.' }),
  M({ id: 'm_asterix', name: 'Patrouilleur Astérix', cls: 'patrouilleur', rarity: 'peu_commun', level: 5, price: { or: 10000 }, canons: 26, size: { L: 40, B: 8.5 }, mod: { hp: 0.85 }, modern: { type: 'patrouilleur', variant: 'asterix', hull: 0x8a949e, top: 0x9aa4ae, accent: 0x2a2e36, deck: 0x5a646e, number: 'P 788' }, history: 'Patrouilleur côtier à la silhouette ramassée, armé d\'un canon de 20 mm.' }),
  M({ id: 'm_pat_marine', name: 'Patrouilleur Marine', cls: 'patrouilleur', rarity: 'rare', level: 6, price: { or: 14000 }, canons: 30, size: { L: 52, B: 9.8 }, mod: { hp: 1.05 }, modern: { type: 'patrouilleur', variant: 'marine', hull: 0x7e8892, top: 0x8e98a2, accent: 0x2a2e36, deck: 0x4e5862, number: 'P 735' }, history: 'Patrouilleur de haute mer avec hélisurface et embarcations rapides.' }),
  M({ id: 'm_pat_loire', name: 'Patrouilleur Loire', cls: 'patrouilleur', rarity: 'rare', level: 7, price: { or: 18000 }, canons: 32, size: { L: 60, B: 11 }, mod: { hp: 1.2, speed: 0.92, cargo: 2 }, modern: { type: 'patrouilleur', variant: 'loire', hull: 0x8a949e, top: 0x9aa4ae, accent: 0xf0c020, deck: 0x4e5862, number: 'A 602' }, history: 'Bâtiment de soutien de la classe Loire, avec sa grande grue de manutention.' }),
  M({ id: 'm_pat_atlantique', name: 'Patrouilleur Atlantique', cls: 'patrouilleur', rarity: 'epique', level: 8, price: { or: 24000 }, canons: 36, size: { L: 66, B: 11.5 }, mod: { hp: 1.3, range: 1.06 }, modern: { type: 'patrouilleur', variant: 'atlantique', hull: 0x76808a, top: 0x86909a, accent: 0x2a2e36, deck: 0x4a545e, number: 'P 801' }, history: 'Patrouilleur océanique de nouvelle génération, mât intégré et hangar pour drone.' }),
  // --- Frégates
  M({ id: 'm_fremm', name: 'Frégate type FREMM', cls: 'fregate_moderne', rarity: 'legendaire', level: 12, price: { or: 60000, diamants: 10 }, canons: 110, size: { L: 98, B: 14.5 }, mod: { hp: 1.1, range: 1.05 }, modern: { type: 'fregate', variant: 'fremm', hull: 0x8a949e, top: 0x9aa4ae, accent: 0x22262c, deck: 0x4a545e, number: 'D 650' }, history: 'Frégate multi-missions : mât pyramidal, 32 silos de missiles, hangar pour hélicoptère.' }),
  M({ id: 'm_horizon', name: 'Frégate type Horizon', cls: 'fregate_moderne', rarity: 'legendaire', level: 14, price: { or: 75000, diamants: 15 }, canons: 120, size: { L: 102, B: 15.5 }, mod: { hp: 1.2, speed: 0.97 }, modern: { type: 'fregate', variant: 'horizon', hull: 0x8a949e, top: 0x9aa4ae, accent: 0x22262c, deck: 0x4a545e, number: 'D 620' }, history: 'Frégate de défense aérienne à deux cheminées et grand radar sous dôme.' }),
  M({ id: 'm_lafayette', name: 'Frégate type La Fayette', cls: 'fregate_moderne', rarity: 'epique', level: 10, price: { or: 45000, diamants: 5 }, canons: 90, size: { L: 86, B: 13.5 }, mod: { hp: 0.9, speed: 1.05, turn: 1.1 }, modern: { type: 'fregate', variant: 'lafayette', hull: 0x8e98a2, top: 0x9ea8b2, accent: 0x22262c, deck: 0x4e5862, number: 'F 710' }, history: 'Première frégate furtive : flancs inclinés, superstructures lisses, mâts carénés.' }),
  M({ id: 'm_fda', name: 'Frégate de défense aérienne', cls: 'fregate_moderne', rarity: 'legendaire', level: 16, price: { or: 90000, diamants: 20 }, canons: 125, size: { L: 106, B: 16 }, mod: { hp: 1.25, range: 1.12, speed: 0.95 }, modern: { type: 'fregate', variant: 'fda', hull: 0x7e8892, top: 0x8e98a2, accent: 0x22262c, deck: 0x464e58, number: 'D 615' }, history: 'Bouclier de l\'escadre : quatre radars plans, 48 silos et canon de 127 mm.' }),
  M({ id: 'm_fdi', name: 'Frégate polyvalente moderne', cls: 'fregate_moderne', rarity: 'legendaire', level: 18, price: { or: 110000, diamants: 25 }, canons: 130, size: { L: 100, B: 15 }, mod: { hp: 1.3, reload: 0.92, speed: 1.02 }, modern: { type: 'fregate', variant: 'fdi', hull: 0x868e98, top: 0x96a0aa, accent: 0x1c2026, deck: 0x464e58, number: 'F 801' }, history: 'Frégate de nouvelle génération, mât unique à panneaux radar et étrave inversée.' }),

  // --- Adversaires de l'ère moderne (PNJ)
  M({ id: 'm_go_fast', name: 'Go-fast de trafiquants', cls: 'vedette', level: 2, price: {}, canons: 5, npcOnly: true, size: { L: 13, B: 3.8 }, mod: { hp: 0.7, speed: 1.15 }, modern: { type: 'vedette', variant: 'rapide', hull: 0x101010, top: 0x2a2a2a, accent: 0x5a5a5a, deck: 0x1a1a1a } }),
  M({ id: 'm_chalutier_pirate', name: 'Chalutier pirate', cls: 'peche', level: 4, price: {}, canons: 8, npcOnly: true, size: { L: 28, B: 8 }, mod: { hp: 1.1 }, modern: { type: 'peche', variant: 'chalutier', hull: 0x3a2a1a, top: 0x8a7a6a, accent: 0x3a3a3a, deck: 0x4a4a4a, number: '??? 00' } }),
  M({ id: 'm_patrouilleur_rebelle', name: 'Patrouilleur rebelle', cls: 'patrouilleur', level: 8, price: {}, canons: 28, npcOnly: true, size: { L: 45, B: 9 }, modern: { type: 'patrouilleur', variant: 'asterix', hull: 0x4a5a3a, top: 0x5a6a4a, accent: 0x2a2e22, deck: 0x3a4430, number: 'R 13' } }),
  M({ id: 'm_fregate_hostile', name: 'Frégate hostile', cls: 'fregate_moderne', level: 14, price: {}, canons: 100, npcOnly: true, size: { L: 92, B: 14 }, mod: { hp: 0.85 }, modern: { type: 'fregate', variant: 'lafayette', hull: 0x5a5a62, top: 0x6a6a72, accent: 0x8a2020, deck: 0x3a3a42, number: 'X 66' } }),
];
