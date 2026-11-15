// Progression secondaire, toujours calculée par le serveur :
// grades de tir, points élite, missions quotidiennes, missions de niveau, pêche.
import { AMMO, type AmmoId } from '../../shared/items.ts';
import {
  DAILY_BY_ID, DAILY_COOLDOWN_H, DAILY_SLOTS, ELITE_RATE, FISH, FISH_ORDER, FISH_RANKS, fishInterval, levelMission,
  playerBonus, rankIndex, SHOOT_RANKS, SHOOT_XP, type DailyKind,
} from '../../shared/extras.ts';
import { fmt } from '../../shared/math.ts';
import { levelFromXp, xpToNext } from '../../shared/progression.ts';
import type { PlayerLink } from '../types.ts';
import type { ShipEnt } from './entities.ts';
import { grant } from './rewards.ts';

function shootGain(link: PlayerLink, pts: number) {
  const p = link.profile;
  const before = rankIndex(SHOOT_RANKS, p.shootXp);
  p.shootXp += pts;
  const after = rankIndex(SHOOT_RANKS, p.shootXp);
  if (after > before) link.notify(`Nouveau grade de tir : ${SHOOT_RANKS[after].name} ! (+1 % de dégâts)`, 'level');
}

/** Dégâts infligés par un joueur : grade de tir, points élite, mission quotidienne. */
export function onDamage(link: PlayerLink, real: number, ammo: AmmoId, targetIsPlayer: boolean) {
  const p = link.profile;
  shootGain(link, real * (targetIsPlayer ? SHOOT_XP.player : SHOOT_XP.npc));
  p.elite += real * ELITE_RATE * (AMMO[ammo]?.elite ?? 1) * (1 + playerBonus(p).econ.elite) * ((p.buffs?.lanterne ?? 0) > Date.now() ? 1.5 : 1);
  dailyProgress(link, 'degats', real);
}

export function onPlayerKill(link: PlayerLink) {
  shootGain(link, SHOOT_XP.playerKill);
}

export function onNpcKill(link: PlayerLink, s: ShipEnt) {
  if (s.faction === 'pirate' || s.faction === 'flibustier') dailyProgress(link, 'pirates', 1);
  if (s.faction === 'anglais' || s.faction === 'flibustier' || s.def.id === 'galion_pirate') dailyProgress(link, 'flibustiers', 1);
  if (s.faction === 'monstre') dailyProgress(link, 'monstres', 1);
  dailyProgress(link, 'navires', 1);
  // Mission de niveau
  const p = link.profile;
  const lvl = levelFromXp(p.xp).level;
  if (p.levelMission.level !== lvl) p.levelMission = { level: lvl, progress: 0 };
  const lm = levelMission(lvl);
  if (s.level >= lm.minLevel && p.levelMission.progress < lm.goal) {
    p.levelMission.progress++;
    if (p.levelMission.progress >= lm.goal) {
      grant(link, { xp: xpToNext(lvl) * lm.xpShare, or: lm.or, perles: 1 }, `Mission de niveau ${lvl} accomplie`);
      p.levelMission = { level: levelFromXp(p.xp).level, progress: p.levelMission.level === levelFromXp(p.xp).level ? lm.goal : 0 };
    }
  }
}

export function onLoot(link: PlayerLink, kind: string) {
  if (kind === 'coffre' || kind === 'tresor') dailyProgress(link, 'tresors', 1);
}

// --- Missions quotidiennes --------------------------------------------------------
export function dailyStart(link: PlayerLink, id: DailyKind, tier: number): string | null {
  const p = link.profile;
  const d = DAILY_BY_ID[id];
  if (!d) return 'Mission inconnue.';
  if (p.daily.active.some((a) => a.id === id)) return 'Mission déjà en cours.';
  if (p.daily.active.length >= DAILY_SLOTS) return `Une seule mission quotidienne à la fois (${DAILY_SLOTS}).`;
  const cd = p.daily.cooldown[id] ?? 0;
  if (cd > Date.now()) return `Disponible dans ${Math.ceil((cd - Date.now()) / 3600000)} h.`;
  p.daily.active.push({ id, progress: 0, goal: d.goal(tier), tier });
  link.touch();
  return null;
}

export function dailyAbandon(link: PlayerLink, id: DailyKind) {
  const p = link.profile;
  p.daily.active = p.daily.active.filter((a) => a.id !== id);
  link.touch();
}

function dailyProgress(link: PlayerLink, id: DailyKind, amount: number) {
  const p = link.profile;
  const a = p.daily.active.find((x) => x.id === id);
  if (!a) return;
  a.progress = Math.min(a.goal, a.progress + amount);
  if (a.progress >= a.goal) {
    p.daily.active = p.daily.active.filter((x) => x !== a);
    p.daily.cooldown[id] = Date.now() + DAILY_COOLDOWN_H * 3600 * 1000;
    grant(link, DAILY_BY_ID[id].reward(a.tier), `Mission quotidienne « ${DAILY_BY_ID[id].name} » accomplie`);
  }
  link.touch();
}

// --- Pêche --------------------------------------------------------------------------
/** Appelé à chaque tick pour un joueur qui pêche. Retourne false s'il doit arrêter. */
export function tickFishing(link: PlayerLink, s: ShipEnt, tier: number, inCombat: boolean, dt: number): boolean {
  if (s.k.speed > 1.5 || inCombat || s.sinking >= 0) return false;
  const p = link.profile;
  const grade = rankIndex(FISH_RANKS, p.fishXp);
  link.fishTimer += dt * (1 + playerBonus(p).econ.fish);
  if (link.fishTimer < fishInterval(grade)) return true;
  link.fishTimer = 0;
  const pool = FISH_ORDER.map((id) => FISH[id]).filter((f) => f.minTier <= tier);
  // Le grade rend les grosses prises plus fréquentes.
  const weights = pool.map((f) => f.weight * (1 + (grade * f.xp) / 60));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  let f = pool[0];
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { f = pool[i]; break; } }
  const before = grade;
  p.fishXp += f.xp;
  if (f.id === 'huitre') { p.perles += 1; link.notify('Pêche : une huître perlière ! +1 perle', 'gain'); }
  else { p.fish[f.id] = (p.fish[f.id] ?? 0) + 1; link.notify(`Pêche : ${f.name} (+${f.xp} pts de pêche)`, 'info'); }
  const after = rankIndex(FISH_RANKS, p.fishXp);
  if (after > before) link.notify(`Nouveau grade de pêche : ${FISH_RANKS[after].name} !`, 'level');
  link.touch();
  return true;
}

export function sellFish(link: PlayerLink, commerce: number) {
  const p = link.profile;
  let total = 0;
  for (const id of FISH_ORDER) {
    const n = p.fish[id] ?? 0;
    total += n * FISH[id].price * (1 + 0.03 * commerce);
    p.fish[id] = 0;
  }
  total = Math.round(total);
  if (!total) return 'Votre vivier est vide.';
  p.or += total;
  link.notify(`Poissons vendus au marché : +${fmt(total)} or`, 'gain');
  return null;
}
