// Les zones maritimes du monde. Chaque zone est une instance de simulation indépendante côté serveur
// (on peut donc les répartir plus tard sur plusieurs processus / machines).
import type { GoodId } from './items.ts';

export type Faction = 'france' | 'pirate' | 'anglais' | 'barbaresque' | 'flibustier' | 'spectre' | 'hollandais' | 'monstre';
export const FACTION_LABEL: Record<Faction, string> = {
  france: 'Marine royale',
  pirate: 'Pirates',
  anglais: 'Royal Navy',
  barbaresque: 'Corsaires barbaresques',
  flibustier: 'Flibustiers',
  spectre: 'Spectres',
  hollandais: 'Marine hollandaise',
  monstre: 'Monstres marins',
};

export type Vegetation = 'tempere' | 'atlantique' | 'mediterraneen' | 'tropical' | 'brumeux';

export interface PortDef {
  id: string;
  name: string;
  x: number;
  z: number;
  r: number; // rayon de l'île du port
  main?: boolean;
  produces: GoodId[]; // bon marché ici
  demands: GoodId[]; // se vend cher ici
}

export interface EnemySpawn { ship: string; faction: Faction; level: number; weight: number }

export interface ZoneDef {
  id: string;
  /** Mer d'origine (ex. « manche ») : deux cartes par mer. */
  sea: string;
  tier: number; // étage de la carte (1 = débutant)
  variant: 1 | 2; // /1 = carte calme, /2 = carte de guerre (PvP libre, meilleures récompenses)
  code: string; // « 3/1 »
  rewardMul: number;
  name: string;
  desc: string;
  levels: [number, number];
  half: number; // demi-taille de la zone (m)
  seed: number;
  pvp: 'consentement' | 'libre';
  islands: number;
  names: string[];
  vegetation: Vegetation;
  ambiance: {
    deep: number;
    shallow: number;
    fog: number; // densité de brouillard de base
    turbidity: number;
    waves: number; // échelle de houle
    timeOffset: number; // décalage de l'heure locale (0..1)
  };
  storms: number; // probabilité relative de tempête
  ports: PortDef[];
  enemies: EnemySpawn[];
  npcCount: number;
  pirateForts: number;
  wrecks: number;
  boss: boolean;
  }

type SeaDef = Omit<ZoneDef, 'sea' | 'tier' | 'variant' | 'code' | 'rewardMul'>;

function sea(id: string, name: string, desc: string, levels: [number, number], seed: number, vegetation: Vegetation, names: string[], ambiance: SeaDef['ambiance'], storms: number, ports: PortDef[], enemies: EnemySpawn[]): SeaDef {
  return { id, name, desc, levels, half: 4400, seed, pvp: 'libre', islands: names.length + 2, vegetation, names, ambiance, storms, ports, enemies, npcCount: 20, pirateForts: 2, wrecks: 6, boss: true };
}

/** Les quinze mers, du plus facile au plus dur (voir ZONES plus bas pour la grille des cartes). */
export const SEAS: SeaDef[] = [
  {
    id: 'manche', name: 'La Manche', desc: 'Eaux grises et courants traîtres entre la Bretagne et la Normandie. Les pirates guettent les convois, la Royal Navy n\'est jamais loin.',
    levels: [1, 5], half: 4200, seed: 1692, pvp: 'consentement', islands: 26, vegetation: 'tempere',
    names: ['Île d\'Ouessant', 'Île de Sein', 'Île de Batz', 'Bréhat', 'Archipel de Chausey', 'Les Minquiers', 'Les Sept-Îles', 'Île Molène', 'Roches-Douvres', 'Les Écréhou', 'Île Tomé', 'Île Verte', 'Rocher du Grand Léjon', 'Île Harbour', 'Île Agot', 'Les Héaux', 'Île Callot', 'Île de Siec', 'Île Louet', 'Rocher de la Horaine', 'Île Milliau', 'Les Triagoz', 'Île Saint-Riom', 'Rocher des Moines', 'Île Rouzic', 'Île aux Lapins'],
    ambiance: { deep: 0x0b2a3a, shallow: 0x2f6f73, fog: 0.00028, turbidity: 3.2, waves: 1.0, timeOffset: 0.0 },
    storms: 0.35,
    ports: [
      { id: 'brest', name: 'Brest', x: -2400, z: 2200, r: 330, main: true, produces: ['toile', 'bois', 'armes'], demands: ['vin', 'rhum', 'epices'] },
      { id: 'saint_malo', name: 'Saint-Malo', x: 1500, z: 2700, r: 300, produces: ['sel', 'toile'], demands: ['armes', 'cafe', 'soie'] },
      { id: 'cherbourg', name: 'Cherbourg', x: 2600, z: -2300, r: 290, produces: ['bois', 'sel'], demands: ['toile', 'vin', 'sucre'] },
    ],
    enemies: [
      { ship: 'pirate_sloop', faction: 'pirate', level: 1, weight: 6 },
      { ship: 'pirate_brick', faction: 'pirate', level: 3, weight: 3 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 5, weight: 1 },
    ],
    npcCount: 18, pirateForts: 1, wrecks: 4, boss: true,
  },
  {
    id: 'atlantique', name: 'Côte Atlantique', desc: 'De Lorient à La Rochelle, la grande houle océane et les escadres anglaises qui bloquent les ports.',
    levels: [4, 8], half: 4600, seed: 1759, pvp: 'consentement', islands: 24, vegetation: 'atlantique',
    names: ['Belle-Île', 'Île de Groix', 'Houat', 'Hœdic', 'Île de Ré', 'Île d\'Aix', 'Île d\'Oléron', 'Île d\'Yeu', 'Noirmoutier', 'Les Glénan', 'Île Dumet', 'Île Madame', 'Fort Boyard', 'Rocher d\'Antioche', 'Île de Sein', 'Les Birvideaux', 'Île Teviec', 'Île Berder', 'Île du Pilier', 'Les Cardinaux', 'Plateau de Rochebonne', 'Île Enet', 'Banc des Bœufs', 'Île de la Recherche'],
    ambiance: { deep: 0x0a2a44, shallow: 0x2b6f86, fog: 0.0002, turbidity: 2.6, waves: 1.25, timeOffset: 0.15 },
    storms: 0.45,
    ports: [
      { id: 'lorient', name: 'Lorient', x: -2600, z: -2200, r: 320, main: true, produces: ['epices', 'soie', 'cafe'], demands: ['bois', 'toile', 'sel'] },
      { id: 'la_rochelle', name: 'La Rochelle', x: 2400, z: 2500, r: 330, produces: ['sel', 'vin'], demands: ['sucre', 'cafe', 'armes'] },
      { id: 'nantes', name: 'Nantes', x: 2800, z: -1800, r: 290, produces: ['sucre', 'toile'], demands: ['vin', 'epices'] },
    ],
    enemies: [
      { ship: 'pirate_brick', faction: 'pirate', level: 4, weight: 4 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 7, weight: 3 },
    ],
    npcCount: 18, pirateForts: 1, wrecks: 4, boss: true,
  },
  {
    id: 'gascogne', name: 'Golfe de Gascogne', desc: 'Le golfe des tempêtes. Ici, la mer elle-même est un ennemi.',
    levels: [7, 11], half: 4400, seed: 1805, pvp: 'libre', islands: 18, vegetation: 'atlantique',
    names: ['Rocher de Cordouan', 'Île aux Oiseaux', 'Banc d\'Arguin', 'Île de Ré du Sud', 'Rocher de la Vierge', 'Les Basques', 'Île des Faisans', 'Roche Ronde', 'Écueil de Rochebonne', 'Haut-Fond des Landes', 'Île Verte du Golfe', 'Rocher du Corsaire', 'Pointe aux Naufrageurs', 'Île Noire', 'Les Dents de Gascogne', 'Banc du Cap Ferret', 'Île Sauvage', 'Roche aux Mouettes'],
    ambiance: { deep: 0x0c2433, shallow: 0x2a5e6a, fog: 0.00026, turbidity: 4.5, waves: 1.6, timeOffset: 0.3 },
    storms: 0.8,
    ports: [
      { id: 'bordeaux', name: 'Bordeaux', x: 2500, z: -2400, r: 340, main: true, produces: ['vin', 'sucre'], demands: ['armes', 'toile', 'epices'] },
      { id: 'bayonne', name: 'Bayonne', x: -2300, z: 2600, r: 300, produces: ['armes', 'bois'], demands: ['vin', 'rhum'] },
    ],
    enemies: [
      { ship: 'pirate_brick', faction: 'pirate', level: 8, weight: 3 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 9, weight: 4 },
      { ship: 'flibustier', faction: 'flibustier', level: 11, weight: 1 },
    ],
    npcCount: 16, pirateForts: 2, wrecks: 6, boss: true,
  },
  {
    id: 'mediterranee', name: 'Méditerranée', desc: 'Eaux turquoise, soleil écrasant et chébecs barbaresques qui fondent sur les marchands.',
    levels: [10, 14], half: 4800, seed: 1676, pvp: 'consentement', islands: 26, vegetation: 'mediterraneen',
    names: ['Porquerolles', 'Port-Cros', 'Île du Levant', 'Îles d\'Hyères', 'Îles de Lérins', 'Sainte-Marguerite', 'Saint-Honorat', 'Îles du Frioul', 'Château d\'If', 'Île de Riou', 'Îles Sanguinaires', 'Île Cavallo', 'Lavezzi', 'Île de Bendor', 'Île des Embiez', 'Île Verte de la Ciotat', 'Île de Jarre', 'Île Maïre', 'Île Plane', 'Îles Cerbicale', 'Scandola', 'Île Rousse', 'Giraglia', 'Île de Bagaud', 'Rocher de la Gabinière', 'Île du Grand Rouveau'],
    ambiance: { deep: 0x0a3a5a, shallow: 0x1f8fa0, fog: 0.00012, turbidity: 1.8, waves: 0.75, timeOffset: 0.42 },
    storms: 0.15,
    ports: [
      { id: 'toulon', name: 'Toulon', x: -2200, z: 2400, r: 340, main: true, produces: ['armes', 'bois', 'toile'], demands: ['epices', 'soie', 'cafe'] },
      { id: 'marseille', name: 'Marseille', x: 2600, z: 2200, r: 330, produces: ['soie', 'sel', 'vin'], demands: ['sucre', 'bois'] },
      { id: 'ajaccio', name: 'Ajaccio', x: 600, z: -3000, r: 300, produces: ['vin', 'bois'], demands: ['toile', 'armes', 'sel'] },
    ],
    enemies: [
      { ship: 'barbaresque', faction: 'barbaresque', level: 11, weight: 5 },
      { ship: 'flibustier', faction: 'flibustier', level: 13, weight: 2 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 13, weight: 2 },
    ],
    npcCount: 20, pirateForts: 2, wrecks: 5, boss: true,
  },
  {
    id: 'caraibes', name: 'Caraïbes', desc: 'Lagons, cocotiers et or espagnol. Le paradis des flibustiers… et leur cimetière.',
    levels: [13, 17], half: 5000, seed: 1715, pvp: 'libre', islands: 30, vegetation: 'tropical',
    names: ['Marie-Galante', 'Les Saintes', 'La Désirade', 'Saint-Barthélemy', 'Île de la Tortue', 'Île à Vache', 'Saint-Martin', 'Petite-Terre', 'Île aux Rats', 'Rocher du Diamant', 'Îlet à Cabrit', 'Îlet du Gosier', 'Cayes des Flibustiers', 'Île de la Gonâve', 'Îlet Ramier', 'Îlet Chancel', 'Grand Cayman', 'Îlet Caret', 'Île Fourchue', 'Anse aux Trésors', 'Caye du Mort', 'Îlet Pinel', 'Îlet Kahouanne', 'Tintamarre', 'Îlet Oscar', 'Banc de la Baleine', 'Caye Verte', 'Îlet Madame', 'Rocher du Pélican', 'Île Navasse'],
    ambiance: { deep: 0x0a4a6e, shallow: 0x21b3b3, fog: 0.0001, turbidity: 1.6, waves: 0.85, timeOffset: 0.55 },
    storms: 0.4,
    ports: [
      { id: 'fort_royal', name: 'Fort-Royal', x: -2600, z: 2600, r: 360, main: true, produces: ['rhum', 'sucre', 'cafe'], demands: ['armes', 'vin', 'toile'] },
      { id: 'basse_terre', name: 'Basse-Terre', x: 2800, z: 2000, r: 320, produces: ['cafe', 'sucre'], demands: ['sel', 'bois'] },
      { id: 'cap_francais', name: 'Cap-Français', x: 400, z: -3200, r: 330, produces: ['sucre', 'rhum'], demands: ['soie', 'vin', 'armes'] },
    ],
    enemies: [
      { ship: 'flibustier', faction: 'flibustier', level: 14, weight: 5 },
      { ship: 'pirate_brick', faction: 'pirate', level: 13, weight: 2 },
      { ship: 'anglais_74', faction: 'anglais', level: 17, weight: 1 },
    ],
    npcCount: 22, pirateForts: 3, wrecks: 8, boss: true,
  },
  {
    id: 'indien', name: 'Océan Indien', desc: 'La route des Indes, des épices et de la soie. Les eaux de Suffren.',
    levels: [16, 19], half: 5200, seed: 1782, pvp: 'libre', islands: 22, vegetation: 'tropical',
    names: ['Île de France', 'Île Bourbon', 'Île Rodrigues', 'Les Seychelles', 'Mahé', 'Praslin', 'La Digue', 'Île Tromelin', 'Agaléga', 'Saint-Brandon', 'Île Juan de Nova', 'Europa', 'Glorieuses', 'Mayotte', 'Île Sainte-Marie', 'Nosy Be', 'Île aux Cerfs', 'Coin de Mire', 'Île Plate', 'Île Ronde', 'Récif des Naufrages', 'Banc des Pirates'],
    ambiance: { deep: 0x072f52, shallow: 0x1a9ab0, fog: 0.00014, turbidity: 2, waves: 1.3, timeOffset: 0.7 },
    storms: 0.55,
    ports: [
      { id: 'port_louis', name: 'Port-Louis', x: -2400, z: -2600, r: 350, main: true, produces: ['epices', 'sucre'], demands: ['armes', 'vin', 'toile'] },
      { id: 'pondichery', name: 'Pondichéry', x: 2800, z: 2600, r: 340, produces: ['soie', 'epices', 'cafe'], demands: ['vin', 'armes', 'bois'] },
    ],
    enemies: [
      { ship: 'anglais_74', faction: 'anglais', level: 17, weight: 3 },
      { ship: 'flibustier', faction: 'flibustier', level: 17, weight: 4 },
      { ship: 'barbaresque', faction: 'barbaresque', level: 16, weight: 2 },
    ],
    npcCount: 20, pirateForts: 2, wrecks: 6, boss: true,
  },
  {
    id: 'brumes', name: 'Mer des Brumes', desc: 'Zone maritime dangereuse. Un brouillard éternel où dérivent les épaves… et ce qui les a coulées.',
    levels: [18, 21], half: 4000, seed: 1709, pvp: 'libre', islands: 16, vegetation: 'brumeux',
    names: ['Récif des Âmes', 'Île du Pendu', 'Rocher Noir', 'Écueil des Damnés', 'Île Sans-Nom', 'La Mâchoire', 'Banc des Ossements', 'Îlot du Silence', 'Rocher du Glas', 'Île Morte', 'Récif du Sabbat', 'La Dent du Diable', 'Île aux Corbeaux', 'Îlot Funèbre', 'Roche des Noyés', 'Île du Dernier Phare'],
    ambiance: { deep: 0x081a1c, shallow: 0x1d3f3b, fog: 0.0007, turbidity: 7, waves: 1.4, timeOffset: 0.88 },
    storms: 0.6,
    ports: [
      { id: 'dernier_phare', name: 'Fort du Dernier Phare', x: 0, z: 3000, r: 300, main: true, produces: ['armes'], demands: ['rhum', 'vin', 'epices', 'soie'] },
    ],
    enemies: [
      { ship: 'flibustier', faction: 'flibustier', level: 19, weight: 3 },
      { ship: 'anglais_74', faction: 'spectre', level: 20, weight: 3 },
    ],
    npcCount: 18, pirateForts: 3, wrecks: 12, boss: true,
  },
  sea('mer_du_nord', 'Mer du Nord', 'Brumes froides, bancs de sable et escadres hollandaises et anglaises qui verrouillent les détroits.', [20, 23], 1704, 'tempere',
    ['Île de Texel', 'Banc des Flandres', 'Île d\'Héligoland', 'Les Hinder', 'Banc de Dogger', 'Île de Walcheren', 'Île d\'Ameland', 'Île de Borkum', 'Banc du Sandettie', 'Île de Schiermonnikoog', 'Rocher des Frisons', 'Île de Vlieland', 'Banc des Ruytingen', 'Île de Goeree'],
    { deep: 0x0d2532, shallow: 0x3a6a6a, fog: 0.00032, turbidity: 4, waves: 1.35, timeOffset: 0.1 }, 0.5,
    [{ id: 'dunkerque', name: 'Dunkerque', x: -2300, z: 2400, r: 320, main: true, produces: ['armes', 'toile'], demands: ['vin', 'epices', 'sucre'] }, { id: 'calais', name: 'Calais', x: 2500, z: 2300, r: 300, produces: ['sel', 'bois'], demands: ['soie', 'cafe'] }],
    [{ ship: 'anglais_74', faction: 'anglais', level: 21, weight: 4 }, { ship: 'flibustier', faction: 'pirate', level: 20, weight: 3 }]),
  sea('nouvelle_france', 'Nouvelle-France', 'Le golfe du Saint-Laurent : glaces, forêts sans fin et la lutte pour un continent.', [22, 25], 1758, 'tempere',
    ['Île d\'Anticosti', 'Île du Cap-Breton', 'Île d\'Orléans', 'Îles de la Madeleine', 'Île Saint-Jean', 'Île aux Coudres', 'Île Bonaventure', 'Île Percée', 'Île aux Grues', 'Île Verte du Saint-Laurent', 'Île Scatarie', 'Île Miquelon', 'Île Saint-Pierre', 'Île aux Basques'],
    { deep: 0x0a2638, shallow: 0x2f6276, fog: 0.00026, turbidity: 3, waves: 1.25, timeOffset: 0.6 }, 0.4,
    [{ id: 'quebec', name: 'Québec', x: -2400, z: -2300, r: 340, main: true, produces: ['bois', 'toile'], demands: ['vin', 'armes', 'sel'] }, { id: 'louisbourg', name: 'Louisbourg', x: 2500, z: 2300, r: 310, produces: ['sel', 'armes'], demands: ['rhum', 'sucre'] }, { id: 'port_royal', name: 'Port-Royal', x: 2600, z: -2000, r: 280, produces: ['bois'], demands: ['soie', 'epices'] }],
    [{ ship: 'anglais_74', faction: 'anglais', level: 23, weight: 5 }, { ship: 'anglais_3ponts', faction: 'anglais', level: 25, weight: 1 }]),
  sea('afrique', 'Côte d\'Afrique', 'Du Sénégal au golfe de Guinée : chaleur, alizés et corsaires barbaresques.', [24, 27], 1677, 'mediterraneen',
    ['Île de Gorée', 'Îles de la Madeleine du Cap-Vert', 'Îles du Salut d\'Afrique', 'Île de Bissau', 'Banc d\'Arguin du Sud', 'Île de Corisco', 'Îles de Los', 'Île de Bioko', 'Île du Prince', 'Île Sao Tomé', 'Cap Blanc', 'Cap Vert', 'Île de Carabane', 'Rocher des Esclaves'],
    { deep: 0x0b3a52, shallow: 0x2a9a9a, fog: 0.00014, turbidity: 3.5, waves: 1.0, timeOffset: 0.45 }, 0.25,
    [{ id: 'saint_louis', name: 'Saint-Louis', x: -2500, z: 2200, r: 330, main: true, produces: ['epices', 'sucre'], demands: ['armes', 'toile', 'vin'] }, { id: 'goree', name: 'Gorée', x: 2400, z: -2400, r: 280, produces: ['cafe'], demands: ['sel', 'bois'] }],
    [{ ship: 'barbaresque', faction: 'barbaresque', level: 25, weight: 4 }, { ship: 'flibustier', faction: 'flibustier', level: 26, weight: 3 }, { ship: 'anglais_74', faction: 'anglais', level: 26, weight: 2 }]),
  sea('louisiane', 'Louisiane', 'Le golfe du Mexique et les bouches du Mississippi, repaire des contrebandiers.', [26, 29], 1718, 'tropical',
    ['Île Dauphine', 'Île aux Chats', 'Île Ship', 'Île Grand Terre', 'Barataria', 'Île Dernière', 'Chandeleur', 'Île Breton', 'Île Horn', 'Île Petit Bois', 'Banc de la Balise', 'Île aux Pélicans', 'Bayou des Pirates', 'Île Grand Isle'],
    { deep: 0x0d3a48, shallow: 0x3a8a7a, fog: 0.00018, turbidity: 4, waves: 0.9, timeOffset: 0.3 }, 0.55,
    [{ id: 'nouvelle_orleans', name: 'La Nouvelle-Orléans', x: -2300, z: -2500, r: 340, main: true, produces: ['sucre', 'cafe'], demands: ['vin', 'armes', 'soie'] }, { id: 'biloxi', name: 'Biloxi', x: 2400, z: 2400, r: 290, produces: ['bois', 'rhum'], demands: ['toile', 'sel'] }],
    [{ ship: 'flibustier', faction: 'flibustier', level: 27, weight: 5 }, { ship: 'anglais_3ponts', faction: 'anglais', level: 28, weight: 1 }, { ship: 'anglais_74', faction: 'anglais', level: 27, weight: 2 }]),
  sea('guyane', 'Guyane', 'Côtes de mangroves et îles du Salut : la France équinoxiale.', [28, 31], 1763, 'tropical',
    ['Île Royale', 'Île Saint-Joseph', 'Île du Diable', 'Îlets de Rémire', 'Le Grand Connétable', 'Le Petit Connétable', 'Île du Père', 'Île de la Mère', 'Les Mamelles', 'Île Malingre', 'Îlet la Mère', 'Banc de Kourou', 'Roches de Macouria', 'Île Verte de l\'Oyapock'],
    { deep: 0x163a3a, shallow: 0x5a7a4a, fog: 0.0002, turbidity: 5, waves: 0.95, timeOffset: 0.5 }, 0.45,
    [{ id: 'cayenne', name: 'Cayenne', x: -2500, z: 2300, r: 330, main: true, produces: ['epices', 'sucre', 'cafe'], demands: ['armes', 'vin', 'toile'] }, { id: 'kourou', name: 'Kourou', x: 2300, z: -2400, r: 290, produces: ['bois'], demands: ['sel', 'soie'] }],
    [{ ship: 'flibustier', faction: 'flibustier', level: 29, weight: 4 }, { ship: 'corsaire_amiral', faction: 'pirate', level: 31, weight: 1 }, { ship: 'anglais_3ponts', faction: 'anglais', level: 30, weight: 2 }]),
  sea('mers_du_sud', 'Mers du Sud', 'Lagons du Pacifique, atolls innombrables et la route des grands navigateurs, de Bougainville à La Pérouse.', [30, 33], 1768, 'tropical',
    ['Bora-Bora', 'Moorea', 'Huahine', 'Raiatea', 'Tetiaroa', 'Rangiroa', 'Fakarava', 'Maupiti', 'Tupai', 'Mehetia', 'Tikehau', 'Manihi', 'Anaa', 'Makatea'],
    { deep: 0x063e6e, shallow: 0x18c0c8, fog: 0.0001, turbidity: 1.6, waves: 1.1, timeOffset: 0.7 }, 0.3,
    [{ id: 'papeete', name: 'Papeete', x: -2400, z: 2400, r: 340, main: true, produces: ['cafe', 'epices'], demands: ['armes', 'vin', 'toile', 'sel'] }, { id: 'noumea', name: 'Nouméa', x: 2400, z: -2400, r: 310, produces: ['bois', 'sucre'], demands: ['soie', 'rhum'] }],
    [{ ship: 'corsaire_amiral', faction: 'pirate', level: 32, weight: 2 }, { ship: 'anglais_3ponts', faction: 'anglais', level: 32, weight: 3 }, { ship: 'flibustier', faction: 'flibustier', level: 31, weight: 3 }]),
  sea('mer_de_chine', 'Mer de Chine', 'Jonques de pirates, typhons et comptoirs lointains de Cochinchine.', [32, 36], 1858, 'tropical',
    ['Île de Poulo Condore', 'Île de Phu Quoc', 'Îles Paracels', 'Île de Haïnan du Sud', 'Baie d\'Along', 'Île de la Tortue de Chine', 'Île Cù Lao Chàm', 'Récif des Jonques', 'Île de Côn Sơn', 'Île Lý Sơn', 'Banc des Typhons', 'Île des Pirates', 'Rocher du Dragon', 'Île aux Perles'],
    { deep: 0x0a3348, shallow: 0x2a8a8a, fog: 0.00018, turbidity: 3, waves: 1.3, timeOffset: 0.85 }, 0.65,
    [{ id: 'saigon', name: 'Saïgon', x: -2400, z: -2400, r: 340, main: true, produces: ['soie', 'epices'], demands: ['armes', 'vin', 'toile'] }, { id: 'tourane', name: 'Tourane', x: 2500, z: 2300, r: 300, produces: ['soie', 'sucre'], demands: ['bois', 'sel'] }],
    [{ ship: 'corsaire_amiral', faction: 'pirate', level: 35, weight: 3 }, { ship: 'anglais_3ponts', faction: 'anglais', level: 34, weight: 3 }]),
  sea('tempetes', 'Mer des Tempêtes', 'Au-delà du cap Horn : vagues géantes, glaces et les plus terribles vaisseaux du monde. Réservée aux amiraux.', [35, 40], 1805, 'brumeux',
    ['Cap Horn', 'Île des Glaces', 'Rocher de la Désolation', 'Île Morne', 'Récif du Naufrageur', 'Île des Albatros', 'Banc des Icebergs', 'Île du Vent Hurlant', 'Écueil de la Dernière Prière', 'Île Blanche', 'Rocher du Cap-Hornier', 'Îlot des Damnés'],
    { deep: 0x0a1c26, shallow: 0x2a4a52, fog: 0.00035, turbidity: 8, waves: 1.8, timeOffset: 0.2 }, 0.9,
    [{ id: 'fort_extreme_sud', name: 'Fort de l\'Extrême-Sud', x: 0, z: 3000, r: 320, main: true, produces: ['armes', 'bois'], demands: ['rhum', 'vin', 'epices', 'soie'] }],
    [{ ship: 'corsaire_amiral', faction: 'pirate', level: 38, weight: 3 }, { ship: 'anglais_3ponts', faction: 'spectre', level: 39, weight: 3 }]),
];
/**
 * Grille des cartes : étage N = N-ième mer, deux cartes par étage.
 *  - N/1 : carte calme (PvP seulement si les deux capitaines hissent le pavillon rouge sur les premières mers) ;
 *  - N/2 : carte de guerre (PvP libre hors des ports, ennemis plus nombreux et plus forts, récompenses +30 %).
 * Chaque carte est une zone simulée indépendamment par le serveur.
 */
/** Ports des cartes de guerre (N/2) : d'autres ports français, placés ailleurs sur la carte. */
const WAR_PORTS: Record<string, string[]> = {
  manche: ['Le Havre', 'Dieppe', 'Granville'],
  atlantique: ['Rochefort', 'Les Sables-d\'Olonne', 'Brouage'],
  gascogne: ['Arcachon', 'Saint-Jean-de-Luz'],
  mediterranee: ['Sète', 'Antibes', 'Bastia'],
  caraibes: ['Pointe-à-Pitre', 'Saint-Pierre', 'Port-au-Prince'],
};
const slug = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Ennemis supplémentaires par étage : monstres marins et autres navires, pour varier chaque carte. */
function extraEnemies(tier: number): EnemySpawn[] {
  const L = (base: number) => base + tier * 2;
  const list: EnemySpawn[] = [];
  if (tier <= 2) list.push({ ship: 'chasse_maree', faction: 'pirate', level: L(0), weight: 3 }, { ship: 'crocodile', faction: 'monstre', level: L(0), weight: 2 });
  if (tier >= 2 && tier <= 4) list.push({ ship: 'requin', faction: 'monstre', level: L(3), weight: 2 }, { ship: 'hollandais_fregate', faction: 'hollandais', level: L(4), weight: 2 });
  if (tier >= 4 && tier <= 8) list.push({ ship: 'serpent', faction: 'monstre', level: L(6), weight: 2 }, { ship: 'galion_pirate', faction: 'pirate', level: L(6), weight: 2 });
  if (tier >= 6) list.push({ ship: 'kraken', faction: 'monstre', level: L(8), weight: 2 });
  if (tier >= 10) list.push({ ship: 'leviathan', faction: 'monstre', level: L(10), weight: 1 });
  return list;
}

export const PAIRED_TIERS = 5;
export const ZONES: ZoneDef[] = SEAS.map((s, i) => ({ ...s, enemies: [...s.enemies, ...extraEnemies(i + 1)] })).flatMap((sea, i) => {
  const tier = i + 1;
  if (tier > PAIRED_TIERS) {
    // Cartes 11 à 20 : une seule carte par étage, numérotées à la suite, combat libre.
    const n = 10 + (tier - PAIRED_TIERS);
    return [{ ...sea, id: `${sea.id}-1`, sea: sea.id, tier, variant: 1, code: String(n), rewardMul: 1 + n * 0.04, pvp: 'libre' } as ZoneDef];
  }
  const calm: ZoneDef = { ...sea, id: `${sea.id}-1`, sea: sea.id, tier, variant: 1, code: `${tier}/1`, rewardMul: 1 };
  const war: ZoneDef = {
    ...sea, id: `${sea.id}-2`, sea: sea.id, tier, variant: 2, code: `${tier}/2`, rewardMul: 1.3,
    seed: sea.seed * 7 + 13,
    pvp: 'libre',
    // Ports différents, en miroir de ceux de la carte calme (même commerce, autre géographie).
    ports: sea.ports.map((pt, k) => ({ ...pt, id: slug(WAR_PORTS[sea.id]?.[k] ?? `${pt.id}_2`), name: WAR_PORTS[sea.id]?.[k] ?? `${pt.name} (Nord)`, x: -pt.x, z: -pt.z, produces: pt.demands.slice(0, 2), demands: pt.produces.slice(0, 2).concat(pt.demands.slice(2)) })),
    npcCount: sea.npcCount + 4,
    pirateForts: sea.pirateForts + 1,
    enemies: sea.enemies.map((e) => ({ ...e, level: e.level + 2 })),
    desc: `${sea.desc} Carte de guerre : combat libre entre joueurs hors des ports, ennemis plus redoutables, butin plus riche.`,
  };
  return [calm, war];
});

export const ZONE_BY_ID: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));
export const START_ZONE = 'manche-1';
export const MAX_TIER = SEAS.length;

/** Anciennes sauvegardes : « manche » -> « manche-1 ». */
export function migrateZoneId(id: string) {
  if (ZONE_BY_ID[id]) return id;
  if (ZONE_BY_ID[`${id}-1`]) return `${id}-1`;
  return START_ZONE;
}

/** Mission de passage : ce qu'il faut accomplir à l'étage `tier` pour débloquer l'étage suivant. */
export function tierRequirement(tier: number) {
  const next = SEAS[tier]; // mer de l'étage suivant (index = tier)
  return { kills: 6 + tier * 4, level: next ? Math.max(1, next.levels[0] - 1) : 99 };
}

export function portById(zone: ZoneDef, id: string) {
  return zone.ports.find((p) => p.id === id);
}

/** Rayon de la zone protégée autour d'un port (pas de PvP, les forts tirent sur les ennemis). */
export const PORT_SAFE_RADIUS = 900;
/** Distance maximale pour accoster. */
export const DOCK_RADIUS = 600;

/** Prix d'une marchandise dans un port (déterministe, varie lentement avec le temps). */
export function goodPrice(port: PortDef, good: GoodId, base: number, t: number, seed: number) {
  let f = 1;
  if (port.produces.includes(good)) f = 0.62;
  else if (port.demands.includes(good)) f = 1.55;
  const wobble = 1 + 0.08 * Math.sin(t / 600 + ((seed + good.length * 13 + port.id.length * 7) % 100));
  return Math.max(1, Math.round(base * f * wobble));
}
