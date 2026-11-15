// Bouclier, énergie et compétences actives : chiffres d'équilibrage partagés par le serveur et le client.
// Bouclier : réserve qui absorbe les dégâts avant la coque, puis se recharge quand on n'est plus touché.
// Énergie : se régénère en continu et sert à lancer les compétences (chacune a aussi son temps de recharge).

export type ActiveSkillId = 'bordee' | 'reparation' | 'voiles' | 'rempart' | 'precision';

export interface ActiveSkill {
  id: ActiveSkillId;
  name: string;
  desc: string;
  /** Niveau du capitaine requis. */
  level: number;
  energy: number;
  cooldown: number;
  duration?: number;
  icon: string;
}

export const ACTIVE_SKILLS: ActiveSkill[] = [
  { id: 'bordee', name: 'Bordée concentrée', desc: 'Canons rechargés à l\'instant et +30 % de dégâts pendant 8 s.', level: 1, energy: 35, cooldown: 25, duration: 8, icon: 'canon' },
  { id: 'voiles', name: 'Toutes voiles dehors', desc: '+50 % de vitesse pendant 8 s.', level: 2, energy: 25, cooldown: 30, duration: 8, icon: 'voile' },
  { id: 'reparation', name: 'Charpentiers à l\'ouvrage', desc: 'Répare aussitôt 15 % de la coque.', level: 4, energy: 40, cooldown: 45, icon: 'marteau' },
  { id: 'rempart', name: 'Rempart de bordage', desc: 'Recharge la moitié du bouclier.', level: 7, energy: 50, cooldown: 60, icon: 'guilde' },
  { id: 'precision', name: 'Tir de précision', desc: '+40 % de chances de coup critique pendant 10 s.', level: 10, energy: 45, cooldown: 50, duration: 10, icon: 'epee' },
];
export const ACTIVE_SKILL_BY_ID = Object.fromEntries(ACTIVE_SKILLS.map((s) => [s.id, s])) as Record<ActiveSkillId, ActiveSkill>;

export const ENERGY_MAX = 100;
/** Points d'énergie regagnés par seconde. */
export const ENERGY_REGEN = 2.5;
/** Bouclier d'un navire de joueur : fraction de ses points de vie. */
export const SHIELD_RATIO = 0.3;
/** Secondes sans être touché avant que le bouclier ne se recharge, puis fraction rechargée par seconde. */
export const SHIELD_DELAY = 6;
export const SHIELD_REGEN = 0.06;
export const BASE_CRIT = 0.07;
export const CRIT_MUL = 1.6;
export const SKILL_DMG_BONUS = 0.3;
export const SKILL_CRIT_BONUS = 0.4;
