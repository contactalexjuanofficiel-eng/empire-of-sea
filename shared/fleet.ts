// Jeu en escadre et guerre de guildes : flottes, bonus d'escadre, raids PvP annoncés, territoires.

/** Formation : distance entre deux navires de l'escadre (m). */
export const FLEET_SPACING = 75;
/** Bonus d'escadre : +5 % de dégâts par navire allié à moins de 500 m (3 au maximum). */
export const FLEET_BONUS_PER_ALLY = 0.05;
export const FLEET_BONUS_MAX = 3;
export const FLEET_BONUS_RADIUS = 500;

/**
 * Raids PvP : toutes les 2 heures (heures paires, temps universel), annoncés 10 minutes à l'avance,
 * sur une carte de guerre. Pendant 15 minutes, combat libre pour tous ; la guilde qui marque le plus
 * de points prend le contrôle de la carte.
 */
export const RAID_INTERVAL = 2 * 3600;
export const RAID_WARNING = 10 * 60;
export const RAID_DURATION = 15 * 60;
export const RAID_POINTS = { pvp: 10, npc: 1 } as const;
export const RAID_REWARD = { or: 20000, perles: 5, xp: 4000 } as const;

/** Début (secondes Unix) du prochain raid dont la fin n'est pas encore passée. */
export function raidStartAt(nowSec: number) {
  const cur = Math.floor(nowSec / RAID_INTERVAL) * RAID_INTERVAL;
  return nowSec < cur + RAID_DURATION ? cur : cur + RAID_INTERVAL;
}
/** Carte visée par le raid qui commence à `start` (rotation sur la liste des cartes de guerre). */
export function raidZone<T>(start: number, warZones: T[]): T {
  return warZones[Math.floor(start / RAID_INTERVAL) % warZones.length];
}

/** Revenu d'un territoire : versé toutes les 10 minutes aux membres connectés de la guilde qui le contrôle. */
export const TERRITORY_INTERVAL = 10 * 60;
export const territoryIncome = (tier: number) => 250 * tier;
