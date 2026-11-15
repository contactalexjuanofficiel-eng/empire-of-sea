// Niveaux, expérience, grades militaires et réputation.

export const MAX_LEVEL = 40;

/** XP nécessaire pour passer du niveau `l` au niveau `l + 1`. */
export const xpToNext = (l: number) => Math.round(150 * Math.pow(l, 1.55));

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = xp;
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, need: level >= MAX_LEVEL ? 0 : xpToNext(level) };
}

export const RANKS: { level: number; title: string }[] = [
  { level: 1, title: 'Mousse' },
  { level: 3, title: 'Matelot' },
  { level: 5, title: 'Quartier-maître' },
  { level: 7, title: 'Aspirant' },
  { level: 9, title: 'Enseigne de vaisseau' },
  { level: 12, title: 'Lieutenant de vaisseau' },
  { level: 15, title: 'Capitaine de corvette' },
  { level: 18, title: 'Capitaine de frégate' },
  { level: 21, title: 'Capitaine de vaisseau' },
  { level: 25, title: 'Chef d\'escadre' },
  { level: 28, title: 'Contre-amiral' },
  { level: 32, title: 'Vice-amiral' },
  { level: 36, title: 'Amiral' },
  { level: 40, title: 'Grand Amiral de France' },
];

export function rankOf(level: number): string {
  let t = RANKS[0].title;
  for (const r of RANKS) if (level >= r.level) t = r.title;
  return t;
}

export const REPUTATION_TIERS: { min: number; name: string }[] = [
  { min: 0, name: 'Inconnu' },
  { min: 100, name: 'Remarqué' },
  { min: 500, name: 'Respecté' },
  { min: 1500, name: 'Renommé' },
  { min: 4000, name: 'Illustre' },
  { min: 10000, name: 'Légendaire' },
];
export function reputationName(rep: number): string {
  let n = REPUTATION_TIERS[0].name;
  for (const r of REPUTATION_TIERS) if (rep >= r.min) n = r.name;
  return n;
}
