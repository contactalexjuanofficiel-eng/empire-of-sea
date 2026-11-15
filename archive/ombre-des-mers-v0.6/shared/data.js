// Données de jeu partagées entre le client et le serveur.
// Source de vérité : le client (client/index.html) a encore ses propres copies,
// à remplacer par des imports de ce fichier lors de la migration en modules ES.

export const WORLD = 4000;

// Navires jouables. `req` = points d'élite requis, `price` = or.
export const SHIPS = [
  { n: 'Lougre corsaire',   price: 0,     req: 0,    hp: 0,   spd: 0,   guns: 0, masts: 1, r: 18, desc: '' },
  { n: 'Corvette',          price: 600,   req: 100,  hp: 60,  spd: 10,  guns: 1, masts: 2, r: 21, desc: '+60 PV, +10 vitesse, +1 canon' },
  { n: 'Frégate',           price: 1800,  req: 400,  hp: 140, spd: 0,   guns: 2, masts: 2, r: 24, desc: '+140 PV, +2 canons' },
  { n: 'Vaisseau de ligne', price: 5000,  req: 1200, hp: 300, spd: -10, guns: 4, masts: 3, r: 29, desc: '+300 PV, +4 canons (un peu plus lent)' },
  { n: 'Vaisseau amiral',   price: 12000, req: 3000, hp: 550, spd: -20, guns: 7, masts: 3, r: 34, desc: '+550 PV, +7 canons (lent, mais redoutable)' },
];

// Munitions (slots 1-4). Le boulet standard est illimité.
export const AMMO = [
  { id: 'ball',  n: 'Boulet',        mul: 1,   desc: 'Munition standard, illimitée' },
  { id: 'fire',  n: 'Boulet ardent', mul: 1.6, price: 120, pack: 20, desc: '+60 % de dégâts' },
  { id: 'chain', n: 'Chaînes',       mul: 0.7, price: 90,  pack: 20, desc: 'Ralentit la cible de moitié' },
  { id: 'grape', n: 'Mitraille',     mul: 1,   price: 140, pack: 20, desc: 'Salve large : +2 boulets' },
];

// Objets consommables (slots 5-8).
export const ITEMS = [
  { id: 'rocket', n: 'Roquette',          price: 60, pack: 5, desc: 'Gros dégâts sur la cible, double points d’élite' },
  { id: 'repair', n: 'Réparation rapide', price: 80, pack: 5, desc: 'Soigne 40 % de la coque' },
  { id: 'speed',  n: 'Pierre de vitesse', price: 50, pack: 5, desc: '+50 % de vitesse pendant 12 s' },
  { id: 'shield', n: 'Bouclier',          price: 70, pack: 5, desc: '−25 % de dégâts reçus pendant 12 s' },
];

// Ennemis contrôlés par l'ordinateur.
export const ENEMY_TYPES = [
  { n: 'Lougre',            hp: 60,  spd: 105, dmg: 7,  rl: 3.0, r: 17, gold: 14,  xp: 20,  col: '#8c4a2f', masts: 1, guns: 2 },
  { n: 'Frégate',           hp: 150, spd: 90,  dmg: 11, rl: 2.8, r: 23, gold: 38,  xp: 50,  col: '#6a2f6a', masts: 2, guns: 3 },
  { n: 'Vaisseau de ligne', hp: 320, spd: 72,  dmg: 16, rl: 2.6, r: 30, gold: 100, xp: 130, col: '#25465f', masts: 3, guns: 4 },
  { n: 'Vaisseau amiral',   hp: 700, spd: 62,  dmg: 24, rl: 2.4, r: 36, gold: 260, xp: 300, col: '#1d2a4a', masts: 3, guns: 5 },
];

// Noms de navires français de l'époque de la marine à voile, par type d'ennemi.
export const NAMES = [
  ['Le Revenant', 'La Confiance', 'Le Renard', 'L’Hirondelle', 'Le Cormoran', 'La Bellone', 'Le Hasard', 'La Mouette'],
  ['La Belle Poule', 'L’Hermione', 'La Boudeuse', 'La Sémillante', 'La Résolue', 'La Vénus', 'La Surveillante', 'La Minerve', 'La Cléopâtre', 'La Pomone'],
  ['Le Redoutable', 'Le Bucentaure', 'Le Foudroyant', 'Le Vengeur du Peuple', 'Le Formidable', 'Le Téméraire', 'L’Orient', 'Le Fougueux', 'L’Intrépide', 'Le Héros', 'Le Duguay-Trouin', 'Le Neptune', 'Le Pluton', 'Le Scipion'],
  ['Le Soleil Royal', 'La Couronne', 'Le Royal-Louis', 'L’Océan'],
];

export const ISLAND_NAMES = [
  'Île de la Tortue', 'Rocher du Diamant', 'Anse des Corsaires', 'Île du Phare', 'Récif des Naufragés',
  'Île Sainte-Anne', 'Baie des Flibustiers', 'Île aux Perroquets', 'Rocher du Corbeau', 'Île de Port-Royal',
  'Archipel des Brumes', 'Île Dauphine', 'Île du Roi Soleil', 'Récif de la Hougue', 'Île de Trafalgar',
  'Île Saint-Louis', 'Île Perdue', 'Île de l’Ancre',
];

// Missions du jour (remises à zéro chaque jour).
export const MISSIONS = [
  { id: 'dmg',    n: 'Infliger des dégâts',        goal: 2000, gold: 300, elite: 20 },
  { id: 'sunk',   n: 'Couler des navires',         goal: 8,    gold: 250, elite: 15 },
  { id: 'chests', n: 'Trouver les trésors perdus', goal: 5,    gold: 200, elite: 10 },
];

// Améliorations de navire : coût du niveau `lv` = round(40 * 1.55^lv), niveau max 10.
export const UPGRADE_MAX = 10;
export const upgradeCost = (lv) => Math.round(40 * Math.pow(1.55, lv));

// Monstre marin (pour l'instant uniquement dans le client solo).
export const MONSTER = { n: 'Monstre marin', hp: 450, spd: 85, dmg: 15, r: 36, gold: 220, xp: 180, col: '#2f6b4f' };
export const MONSTER_NAMES = ['Le Kraken', 'Le Léviathan', 'Le Grand Serpent des Brumes'];

// Vent : multiplicateur de vitesse = 1 + WIND_EFFECT * cos(cap - direction du vent).
export const WIND_EFFECT = 0.22;

// Régions : anneaux autour du port de départ (2000, 2000). Plus on s'éloigne, plus c'est dangereux et lucratif.
export const REGIONS = [
  { name: 'Rade de Port-Royal', max: 600,  tier: 0, mult: 1.0 },
  { name: 'Côtes de Bretagne',  max: 1000, tier: 0, mult: 1.25 },
  { name: 'Mer des Antilles',   max: 1400, tier: 1, mult: 1.6 },
  { name: 'Océan des Tempêtes', max: 1800, tier: 1, mult: 2.0 },
  { name: 'Mers du Bout du Monde', max: Infinity, tier: 2, mult: 2.6 },
];
export const regionIndex = (x, y) => {
  const d = Math.hypot(x - 2000, y - 2000);
  return REGIONS.findIndex((r) => d < r.max);
};

// Événement mondial périodique : l'escadre de l'Amiral (un boss).
export const EVENT_EVERY = 300; // secondes de monde entre deux événements
export const BOSS_NAMES = ['Le Soleil Royal', 'Le Bucentaure', 'La Couronne', 'Le Foudroyant'];
