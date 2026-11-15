// Missions proposées par la capitainerie de chaque port. Générées de façon déterministe par période de 10 minutes.
import { GOODS, GOOD_ORDER } from '../../shared/items.ts';
import { rng, hashString } from '../../shared/math.ts';
import type { MissionOffer, Profile } from '../../shared/protocol.ts';
import { FACTION_LABEL, type ZoneDef } from '../../shared/zones.ts';
import type { ZoneWorld } from '../../shared/world.ts';

const PERIOD = 600_000;

export function missionOffers(zone: ZoneDef, world: ZoneWorld, portId: string, now: number, p: Profile): MissionOffer[] {
  const period = Math.floor(now / PERIOD);
  const R = rng(hashString(`${zone.id}:${portId}:${period}`));
  const lvl = zone.levels[0];
  const scale = 1 + lvl * 0.35;
  const offers: MissionOffer[] = [];
  const mk = (o: Omit<MissionOffer, 'id' | 'zone'>, n: number) => offers.push({ ...o, id: `${zone.id}.${portId}.${period}.${n}`, zone: zone.id });

  const factions = [...new Set(zone.enemies.map((e) => e.faction))];
  const f = factions[Math.floor(R() * factions.length)];
  const goal = 3 + Math.floor(R() * 4);
  mk({ type: 'chasse', title: `Chasse : ${FACTION_LABEL[f]}`, desc: `L'Amirauté offre une prime pour ${goal} navires des ${FACTION_LABEL[f]} envoyés par le fond dans les eaux de ${zone.name}.`, goal, target: f, reward: { or: Math.round(goal * 260 * scale), xp: Math.round(goal * 90 * scale), rep: goal * 6, mat: { fer: goal * 2 } } }, 0);

  const others = zone.ports.filter((x) => x.id !== portId);
  if (others.length) {
    const dest = others[Math.floor(R() * others.length)];
    const good = GOOD_ORDER[Math.floor(R() * GOOD_ORDER.length)];
    const qty = 5 + Math.floor(R() * 8);
    mk({ type: 'livraison', title: `Convoi pour ${dest.name}`, desc: `Livrez ${qty} tonneaux de ${GOODS[good].name.toLowerCase()} au port de ${dest.name}. La marchandise est chargée à bord à l'acceptation.`, goal: 1, target: dest.id, cargo: { good, qty }, reward: { or: Math.round(900 * scale), xp: Math.round(160 * scale), rep: 10, mat: { toile: 4 } } }, 1);
  }

  const unknown = world.islands.filter((i) => !i.port && !p.discovered.includes(`${zone.id}:${i.id}`));
  if (unknown.length) {
    const isl = unknown[Math.floor(R() * unknown.length)];
    mk({ type: 'exploration', title: `Reconnaissance : ${isl.name}`, desc: `Les cartographes du Roi ignorent tout de ${isl.name}. Approchez-vous de ses côtes pour en lever le plan.`, goal: 1, target: String(isl.id), reward: { or: Math.round(500 * scale), xp: Math.round(140 * scale), rep: 8, mat: { bois: 4 } } }, 2);
  }

  if (world.wrecks.length) {
    const w = world.wrecks[Math.floor(R() * world.wrecks.length)];
    mk({ type: 'tresor', title: `Trésor de ${w.name.replace('Épave de ', '')}`, desc: `Une carte au trésor mène à ${w.name}. Récupérez le coffre avant les pirates.`, goal: 1, target: String(w.id), reward: { or: Math.round(700 * scale), xp: Math.round(150 * scale), rep: 10, doublons: 5 } }, 3);
  }

  if (zone.boss) {
    mk({ type: 'boss', title: 'Le Spectre des Brumes', desc: 'Quand le brouillard tombe, un vaisseau fantôme hante ces eaux. Infligez-lui 1 500 dégâts lors de sa prochaine apparition.', goal: 1500, target: 'spectre', reward: { or: Math.round(2500 * scale), xp: Math.round(600 * scale), rep: 40, doublons: 20 } }, 4);
  }
  return offers;
}
