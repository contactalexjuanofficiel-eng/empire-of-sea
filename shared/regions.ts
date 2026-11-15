// Grandes régions maritimes : chacune a son ambiance, ses ennemis, son boss, ses ports et sa ressource propre.
// Une région regroupe plusieurs mers (et donc plusieurs cartes de la grille).
import type { GoodId } from './items.ts';
import type { EnemySpawn, Faction } from './zones.ts';

export type RegionId = 'france' | 'nord' | 'mediterranee' | 'ameriques' | 'asie' | 'lointaines';

export interface RegionDef {
  id: RegionId;
  name: string;
  desc: string;
  color: string;
  seas: string[];
  /** Boss régional (navire) et son annonce. */
  boss: { ship: string; faction: Faction; announce: string };
  /** Navires ennemis propres à la région (niveau relatif à la carte). */
  npcs: { ship: string; faction: Faction; dl: number; weight: number }[];
  /** Ressource régionale, produite par les ports de la région. */
  good: GoodId;
}

export const REGIONS: RegionDef[] = [
  { id: 'france', name: 'Côtes de France', desc: 'Manche, Atlantique et Gascogne : là où tout commence.', color: '#5d9cc4', seas: ['manche', 'atlantique', 'gascogne'],
    boss: { ship: 'spectre', faction: 'spectre', announce: 'Le brouillard se lève… {boss} a été aperçu ! Unissez vos forces pour le couler.' },
    npcs: [], good: 'toile' },
  { id: 'mediterranee', name: 'Méditerranée et Levant', desc: 'Eaux turquoise, galères barbaresques et comptoirs français de la mer Égée.', color: '#2fb3b3', seas: ['mediterranee'],
    boss: { ship: 'colosse_bronze', faction: 'barbaresque', announce: 'Un éclat de bronze à l\'horizon… {boss} sort de son port ! Toutes les escadres au combat.' },
    npcs: [{ ship: 'galere_barbaresque', faction: 'barbaresque', dl: 1, weight: 3 }, { ship: 'felouque', faction: 'barbaresque', dl: 0, weight: 2 }], good: 'huile' },
  { id: 'ameriques', name: 'Amériques', desc: 'Caraïbes, Louisiane, Guyane et Nouvelle-France : flibustiers, tabac et or.', color: '#34866b', seas: ['caraibes', 'nouvelle_france', 'louisiane', 'guyane'],
    boss: { ship: 'roi_flibustiers', faction: 'flibustier', announce: 'Les cloches sonnent dans les comptoirs : {boss} a hissé son pavillon !' },
    npcs: [{ ship: 'boucanier', faction: 'flibustier', dl: 1, weight: 3 }], good: 'tabac' },
  { id: 'nord', name: 'Mers du Nord', desc: 'Brumes froides, glaces dérivantes et corsaires de Dunkerque.', color: '#9fc8e0', seas: ['mer_du_nord', 'tempetes'],
    boss: { ship: 'jarl_glaces', faction: 'spectre', announce: 'Le froid mord les voiles… {boss} dérive parmi les glaces ! Rassemblez la flotte.' },
    npcs: [{ ship: 'corsaire_dunkerque', faction: 'hollandais', dl: 1, weight: 3 }, { ship: 'baleinier_arme', faction: 'anglais', dl: 0, weight: 2 }], good: 'fourrures' },
  { id: 'asie', name: 'Mers d\'Asie', desc: 'Océan Indien, mer de Chine et mers du Sud : jonques pirates et typhons.', color: '#d06a4a', seas: ['indien', 'mer_de_chine', 'mers_du_sud'],
    boss: { ship: 'dragon_typhons', faction: 'monstre', announce: 'Le ciel se déchire : {boss} surgit de l\'œil du typhon !' },
    npcs: [{ ship: 'jonque_pirate', faction: 'pirate', dl: 1, weight: 3 }], good: 'the' },
  { id: 'lointaines', name: 'Mers lointaines', desc: 'Côte d\'Afrique et Mer des Brumes : les confins du monde connu.', color: '#a07ad0', seas: ['afrique', 'brumes'],
    boss: { ship: 'spectre', faction: 'spectre', announce: 'Le brouillard se lève… {boss} a été aperçu ! Unissez vos forces pour le couler.' },
    npcs: [], good: 'epices' },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;
export const regionOfSea = (sea: string): RegionDef => REGIONS.find((r) => r.seas.includes(sea)) ?? REGIONS[0];

/** Ennemis régionaux pour une mer dont les niveaux commencent à `lvl`. */
export function regionalEnemies(sea: string, lvl: number): EnemySpawn[] {
  return regionOfSea(sea).npcs.map((n) => ({ ship: n.ship, faction: n.faction, level: lvl + n.dl, weight: n.weight }));
}
