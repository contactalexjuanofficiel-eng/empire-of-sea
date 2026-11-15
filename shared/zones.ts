// Les zones maritimes du monde. Chaque zone est une instance de simulation indépendante côté serveur
// (on peut donc les répartir plus tard sur plusieurs processus / machines).
import type { GoodId } from './items.ts';

export type Faction = 'france' | 'pirate' | 'anglais' | 'barbaresque' | 'flibustier' | 'spectre';
export const FACTION_LABEL: Record<Faction, string> = {
  france: 'Marine royale',
  pirate: 'Pirates',
  anglais: 'Royal Navy',
  barbaresque: 'Corsaires barbaresques',
  flibustier: 'Flibustiers',
  spectre: 'Spectres',
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
  travelCost: number;
  mapPos: { x: number; y: number }; // position sur la carte du monde (0..100)
}

export const ZONES: ZoneDef[] = [
  {
    id: 'manche', name: 'La Manche', desc: 'Eaux grises et courants traîtres entre la Bretagne et la Normandie. Les pirates guettent les convois, la Royal Navy n\'est jamais loin.',
    levels: [1, 8], half: 4200, seed: 1692, pvp: 'consentement', islands: 26, vegetation: 'tempere',
    names: ['Île d\'Ouessant', 'Île de Sein', 'Île de Batz', 'Bréhat', 'Archipel de Chausey', 'Les Minquiers', 'Les Sept-Îles', 'Île Molène', 'Roches-Douvres', 'Les Écréhou', 'Île Tomé', 'Île Verte', 'Rocher du Grand Léjon', 'Île Harbour', 'Île Agot', 'Les Héaux', 'Île Callot', 'Île de Siec', 'Île Louet', 'Rocher de la Horaine', 'Île Milliau', 'Les Triagoz', 'Île Saint-Riom', 'Rocher des Moines', 'Île Rouzic', 'Île aux Lapins'],
    ambiance: { deep: 0x0b2a3a, shallow: 0x2f6f73, fog: 0.00028, turbidity: 6, waves: 1.0, timeOffset: 0.0 },
    storms: 0.35,
    ports: [
      { id: 'brest', name: 'Brest', x: -2400, z: 2200, r: 330, main: true, produces: ['toile', 'bois', 'armes'], demands: ['vin', 'rhum', 'epices'] },
      { id: 'saint_malo', name: 'Saint-Malo', x: 1500, z: 2700, r: 300, produces: ['sel', 'toile'], demands: ['armes', 'cafe', 'soie'] },
      { id: 'cherbourg', name: 'Cherbourg', x: 2600, z: -2300, r: 290, produces: ['bois', 'sel'], demands: ['toile', 'vin', 'sucre'] },
    ],
    enemies: [
      { ship: 'pirate_sloop', faction: 'pirate', level: 1, weight: 6 },
      { ship: 'pirate_brick', faction: 'pirate', level: 3, weight: 3 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 6, weight: 1 },
    ],
    npcCount: 18, pirateForts: 1, wrecks: 4, boss: true, travelCost: 0, mapPos: { x: 46, y: 24 },
  },
  {
    id: 'atlantique', name: 'Côte Atlantique', desc: 'De Lorient à La Rochelle, la grande houle océane et les escadres anglaises qui bloquent les ports.',
    levels: [6, 14], half: 4600, seed: 1759, pvp: 'consentement', islands: 24, vegetation: 'atlantique',
    names: ['Belle-Île', 'Île de Groix', 'Houat', 'Hœdic', 'Île de Ré', 'Île d\'Aix', 'Île d\'Oléron', 'Île d\'Yeu', 'Noirmoutier', 'Les Glénan', 'Île Dumet', 'Île Madame', 'Fort Boyard', 'Rocher d\'Antioche', 'Île de Sein', 'Les Birvideaux', 'Île Teviec', 'Île Berder', 'Île du Pilier', 'Les Cardinaux', 'Plateau de Rochebonne', 'Île Enet', 'Banc des Bœufs', 'Île de la Recherche'],
    ambiance: { deep: 0x0a2a44, shallow: 0x2b6f86, fog: 0.0002, turbidity: 4, waves: 1.25, timeOffset: 0.15 },
    storms: 0.45,
    ports: [
      { id: 'lorient', name: 'Lorient', x: -2600, z: -2200, r: 320, main: true, produces: ['epices', 'soie', 'cafe'], demands: ['bois', 'toile', 'sel'] },
      { id: 'la_rochelle', name: 'La Rochelle', x: 2400, z: 2500, r: 330, produces: ['sel', 'vin'], demands: ['sucre', 'cafe', 'armes'] },
      { id: 'nantes', name: 'Nantes', x: 2800, z: -1800, r: 290, produces: ['sucre', 'toile'], demands: ['vin', 'epices'] },
    ],
    enemies: [
      { ship: 'pirate_brick', faction: 'pirate', level: 5, weight: 4 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 8, weight: 4 },
      { ship: 'anglais_74', faction: 'anglais', level: 14, weight: 1 },
    ],
    npcCount: 18, pirateForts: 1, wrecks: 4, boss: true, travelCost: 800, mapPos: { x: 40, y: 38 },
  },
  {
    id: 'gascogne', name: 'Golfe de Gascogne', desc: 'Le golfe des tempêtes. Ici, la mer elle-même est un ennemi.',
    levels: [10, 18], half: 4400, seed: 1805, pvp: 'libre', islands: 18, vegetation: 'atlantique',
    names: ['Rocher de Cordouan', 'Île aux Oiseaux', 'Banc d\'Arguin', 'Île de Ré du Sud', 'Rocher de la Vierge', 'Les Basques', 'Île des Faisans', 'Roche Ronde', 'Écueil de Rochebonne', 'Haut-Fond des Landes', 'Île Verte du Golfe', 'Rocher du Corsaire', 'Pointe aux Naufrageurs', 'Île Noire', 'Les Dents de Gascogne', 'Banc du Cap Ferret', 'Île Sauvage', 'Roche aux Mouettes'],
    ambiance: { deep: 0x0c2433, shallow: 0x2a5e6a, fog: 0.00026, turbidity: 8, waves: 1.6, timeOffset: 0.3 },
    storms: 0.8,
    ports: [
      { id: 'bordeaux', name: 'Bordeaux', x: 2500, z: -2400, r: 340, main: true, produces: ['vin', 'sucre'], demands: ['armes', 'toile', 'epices'] },
      { id: 'bayonne', name: 'Bayonne', x: -2300, z: 2600, r: 300, produces: ['armes', 'bois'], demands: ['vin', 'rhum'] },
    ],
    enemies: [
      { ship: 'pirate_brick', faction: 'pirate', level: 9, weight: 3 },
      { ship: 'anglais_fregate', faction: 'anglais', level: 11, weight: 4 },
      { ship: 'flibustier', faction: 'flibustier', level: 16, weight: 2 },
    ],
    npcCount: 16, pirateForts: 2, wrecks: 6, boss: true, travelCost: 1500, mapPos: { x: 42, y: 52 },
  },
  {
    id: 'mediterranee', name: 'Méditerranée', desc: 'Eaux turquoise, soleil écrasant et chébecs barbaresques qui fondent sur les marchands.',
    levels: [14, 24], half: 4800, seed: 1676, pvp: 'consentement', islands: 26, vegetation: 'mediterraneen',
    names: ['Porquerolles', 'Port-Cros', 'Île du Levant', 'Îles d\'Hyères', 'Îles de Lérins', 'Sainte-Marguerite', 'Saint-Honorat', 'Îles du Frioul', 'Château d\'If', 'Île de Riou', 'Îles Sanguinaires', 'Île Cavallo', 'Lavezzi', 'Île de Bendor', 'Île des Embiez', 'Île Verte de la Ciotat', 'Île de Jarre', 'Île Maïre', 'Île Plane', 'Îles Cerbicale', 'Scandola', 'Île Rousse', 'Giraglia', 'Île de Bagaud', 'Rocher de la Gabinière', 'Île du Grand Rouveau'],
    ambiance: { deep: 0x0a3a5a, shallow: 0x1f8fa0, fog: 0.00012, turbidity: 2.5, waves: 0.75, timeOffset: 0.42 },
    storms: 0.15,
    ports: [
      { id: 'toulon', name: 'Toulon', x: -2200, z: 2400, r: 340, main: true, produces: ['armes', 'bois', 'toile'], demands: ['epices', 'soie', 'cafe'] },
      { id: 'marseille', name: 'Marseille', x: 2600, z: 2200, r: 330, produces: ['soie', 'sel', 'vin'], demands: ['sucre', 'bois'] },
      { id: 'ajaccio', name: 'Ajaccio', x: 600, z: -3000, r: 300, produces: ['vin', 'bois'], demands: ['toile', 'armes', 'sel'] },
    ],
    enemies: [
      { ship: 'barbaresque', faction: 'barbaresque', level: 14, weight: 6 },
      { ship: 'flibustier', faction: 'flibustier', level: 18, weight: 2 },
      { ship: 'anglais_74', faction: 'anglais', level: 20, weight: 1 },
    ],
    npcCount: 20, pirateForts: 2, wrecks: 5, boss: true, travelCost: 2500, mapPos: { x: 60, y: 60 },
  },
  {
    id: 'caraibes', name: 'Caraïbes', desc: 'Lagons, cocotiers et or espagnol. Le paradis des flibustiers… et leur cimetière.',
    levels: [20, 30], half: 5000, seed: 1715, pvp: 'libre', islands: 30, vegetation: 'tropical',
    names: ['Marie-Galante', 'Les Saintes', 'La Désirade', 'Saint-Barthélemy', 'Île de la Tortue', 'Île à Vache', 'Saint-Martin', 'Petite-Terre', 'Île aux Rats', 'Rocher du Diamant', 'Îlet à Cabrit', 'Îlet du Gosier', 'Cayes des Flibustiers', 'Île de la Gonâve', 'Îlet Ramier', 'Îlet Chancel', 'Grand Cayman', 'Îlet Caret', 'Île Fourchue', 'Anse aux Trésors', 'Caye du Mort', 'Îlet Pinel', 'Îlet Kahouanne', 'Tintamarre', 'Îlet Oscar', 'Banc de la Baleine', 'Caye Verte', 'Îlet Madame', 'Rocher du Pélican', 'Île Navasse'],
    ambiance: { deep: 0x0a4a6e, shallow: 0x21b3b3, fog: 0.0001, turbidity: 2, waves: 0.85, timeOffset: 0.55 },
    storms: 0.4,
    ports: [
      { id: 'fort_royal', name: 'Fort-Royal', x: -2600, z: 2600, r: 360, main: true, produces: ['rhum', 'sucre', 'cafe'], demands: ['armes', 'vin', 'toile'] },
      { id: 'basse_terre', name: 'Basse-Terre', x: 2800, z: 2000, r: 320, produces: ['cafe', 'sucre'], demands: ['sel', 'bois'] },
      { id: 'cap_francais', name: 'Cap-Français', x: 400, z: -3200, r: 330, produces: ['sucre', 'rhum'], demands: ['soie', 'vin', 'armes'] },
    ],
    enemies: [
      { ship: 'flibustier', faction: 'flibustier', level: 22, weight: 5 },
      { ship: 'pirate_brick', faction: 'pirate', level: 20, weight: 3 },
      { ship: 'anglais_74', faction: 'anglais', level: 26, weight: 2 },
    ],
    npcCount: 22, pirateForts: 3, wrecks: 8, boss: true, travelCost: 4000, mapPos: { x: 16, y: 62 },
  },
  {
    id: 'indien', name: 'Océan Indien', desc: 'La route des Indes, des épices et de la soie. Les eaux de Suffren.',
    levels: [26, 36], half: 5200, seed: 1782, pvp: 'libre', islands: 22, vegetation: 'tropical',
    names: ['Île de France', 'Île Bourbon', 'Île Rodrigues', 'Les Seychelles', 'Mahé', 'Praslin', 'La Digue', 'Île Tromelin', 'Agaléga', 'Saint-Brandon', 'Île Juan de Nova', 'Europa', 'Glorieuses', 'Mayotte', 'Île Sainte-Marie', 'Nosy Be', 'Île aux Cerfs', 'Coin de Mire', 'Île Plate', 'Île Ronde', 'Récif des Naufrages', 'Banc des Pirates'],
    ambiance: { deep: 0x072f52, shallow: 0x1a9ab0, fog: 0.00014, turbidity: 3, waves: 1.3, timeOffset: 0.7 },
    storms: 0.55,
    ports: [
      { id: 'port_louis', name: 'Port-Louis', x: -2400, z: -2600, r: 350, main: true, produces: ['epices', 'sucre'], demands: ['armes', 'vin', 'toile'] },
      { id: 'pondichery', name: 'Pondichéry', x: 2800, z: 2600, r: 340, produces: ['soie', 'epices', 'cafe'], demands: ['vin', 'armes', 'bois'] },
    ],
    enemies: [
      { ship: 'anglais_74', faction: 'anglais', level: 30, weight: 4 },
      { ship: 'flibustier', faction: 'flibustier', level: 28, weight: 4 },
      { ship: 'barbaresque', faction: 'barbaresque', level: 26, weight: 2 },
    ],
    npcCount: 20, pirateForts: 2, wrecks: 6, boss: true, travelCost: 6000, mapPos: { x: 82, y: 70 },
  },
  {
    id: 'brumes', name: 'Mer des Brumes', desc: 'Zone maritime dangereuse. Un brouillard éternel où dérivent les épaves… et ce qui les a coulées.',
    levels: [32, 40], half: 4000, seed: 1709, pvp: 'libre', islands: 16, vegetation: 'brumeux',
    names: ['Récif des Âmes', 'Île du Pendu', 'Rocher Noir', 'Écueil des Damnés', 'Île Sans-Nom', 'La Mâchoire', 'Banc des Ossements', 'Îlot du Silence', 'Rocher du Glas', 'Île Morte', 'Récif du Sabbat', 'La Dent du Diable', 'Île aux Corbeaux', 'Îlot Funèbre', 'Roche des Noyés', 'Île du Dernier Phare'],
    ambiance: { deep: 0x081a1c, shallow: 0x1d3f3b, fog: 0.0007, turbidity: 10, waves: 1.4, timeOffset: 0.88 },
    storms: 0.6,
    ports: [
      { id: 'dernier_phare', name: 'Fort du Dernier Phare', x: 0, z: 3000, r: 300, main: true, produces: ['armes'], demands: ['rhum', 'vin', 'epices', 'soie'] },
    ],
    enemies: [
      { ship: 'flibustier', faction: 'flibustier', level: 34, weight: 3 },
      { ship: 'anglais_74', faction: 'spectre', level: 36, weight: 3 },
    ],
    npcCount: 18, pirateForts: 3, wrecks: 12, boss: true, travelCost: 9000, mapPos: { x: 66, y: 12 },
  },
];

export const ZONE_BY_ID: Record<string, ZoneDef> = Object.fromEntries(ZONES.map((z) => [z.id, z]));
export const START_ZONE = 'manche';

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
