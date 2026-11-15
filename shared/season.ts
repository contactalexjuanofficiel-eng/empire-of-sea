// Saisons compétitives : une saison par mois (temps universel). Les points de saison repartent de zéro chaque mois.
export const SEASON_POINTS = { npc: 1, boss: 25, pvp: 5 } as const;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function seasonId(now = Date.now()) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function seasonName(id = seasonId()) {
  const [y, m] = id.split('-').map(Number);
  return `Saison de ${MOIS[(m || 1) - 1]} ${y}`;
}
/** Points de la saison en cours (0 si le profil date d'une saison passée). */
export const seasonPoints = (s: { id: string; points: number } | undefined, now = Date.now()) => (s && s.id === seasonId(now) ? s.points : 0);
