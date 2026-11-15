// Attribution des récompenses et suivi des missions (toujours côté serveur).
import { MATERIAL_NAMES, type MaterialId } from '../../shared/items.ts';
import { EQUIP_NAME, type EquipId } from '../../shared/equipment.ts';
import { playerBonus } from '../../shared/extras.ts';
import { fmt } from '../../shared/math.ts';
import { levelFromXp, rankOf } from '../../shared/progression.ts';
import type { MissionType } from '../../shared/protocol.ts';
import type { PlayerLink } from '../types.ts';

export interface Reward { ferraille?: number; or?: number; xp?: number; rep?: number; doublons?: number; perles?: number; diamants?: number; mat?: Partial<Record<MaterialId, number>>; equip?: Partial<Record<EquipId, number>> }

export function grant(link: PlayerLink, r: Reward, reason: string) {
  const p = link.profile;
  const before = levelFromXp(p.xp).level;
  const parts: string[] = [];
  // Capitaines économiques : bonus d'or et d'expérience.
  const econ = playerBonus(p).econ;
  r = { ...r, or: r.or ? r.or * (1 + econ.gold) : r.or, xp: r.xp ? r.xp * (1 + econ.xp) : r.xp };
  if (r.ferraille) { p.ferraille += Math.round(r.ferraille); parts.push(`+${fmt(r.ferraille)} ferraille`); }
  if (r.or) { p.or += Math.round(r.or); parts.push(`+${fmt(r.or)} or`); }
  if (r.xp) { p.xp += Math.round(r.xp); parts.push(`+${fmt(r.xp)} XP`); }
  if (r.rep) { p.reputation += Math.round(r.rep); parts.push(`+${fmt(r.rep)} réputation`); }
  if (r.doublons) { p.doublons += Math.round(r.doublons); parts.push(`+${fmt(r.doublons)} doublons`); }
  if (r.perles) { p.perles += Math.round(r.perles); parts.push(`+${fmt(r.perles)} perles`); }
  if (r.diamants) { p.diamants += Math.round(r.diamants); parts.push(`+${fmt(r.diamants)} diamant${r.diamants > 1 ? 's' : ''}`); }
  if (r.equip) for (const [k, v] of Object.entries(r.equip) as [EquipId, number][]) {
    if (!v) continue;
    p.equip[k] = (p.equip[k] ?? 0) + v;
    parts.push(`+${v} ${EQUIP_NAME(k).toLowerCase()}`);
  }
  if (r.mat) for (const [k, v] of Object.entries(r.mat) as [MaterialId, number][]) {
    if (!v) continue;
    p.mat[k] += Math.round(v);
    parts.push(`+${v} ${MATERIAL_NAMES[k].toLowerCase()}`);
  }
  if (parts.length) link.notify(`${reason} : ${parts.join(', ')}`, 'gain');
  const after = levelFromXp(p.xp).level;
  if (after > before) {
    link.notify(`Niveau ${after} ! Vous êtes promu ${rankOf(after)}. Un point de compétence vous attend au port.`, 'level');
  }
  link.touch();
}

export function progressMission(link: PlayerLink, type: MissionType, target: string | null, amount: number) {
  const p = link.profile;
  let changed = false;
  for (const m of [...p.missions]) {
    if (m.type !== type || m.zone !== link.zoneId) continue;
    if (m.target && target !== null && m.target !== target) continue;
    m.progress = Math.min(m.goal, m.progress + amount);
    changed = true;
    if (m.progress >= m.goal) {
      p.missions = p.missions.filter((x) => x !== m);
      grant(link, m.reward, `Mission accomplie « ${m.title} »`);
    }
  }
  if (changed) link.touch();
}
