// Économie : chantier naval, arsenal, améliorations, marché, compétences. Toutes les vérifications sont ici.
import { CAPTAIN_BY_ID, FORGE, SKINS } from '../../shared/extras.ts';
import { sellFish } from './progress.ts';
import { CANNONS, fitCount, isCannon, isMast, MAST_CAPACITY, MASTS } from '../../shared/equipment.ts';
import { AMMO, CONSUMABLES, GOODS, MAX_SKILL, MAX_UPGRADE, UPGRADE_INFO, upgradeCost, type GoodId } from '../../shared/items.ts';
import { fmt } from '../../shared/math.ts';
import type { MissionOffer, ShopAction } from '../../shared/protocol.ts';
import { SHIP_BY_ID, SHIP_CLASSES } from '../../shared/ships.ts';
import { goodPrice, type ZoneDef } from '../../shared/zones.ts';
import { activeShip, activeStats, cargoUsed, giveShip, playerLevel, skillPointsLeft } from '../profile.ts';
import type { PlayerLink } from '../types.ts';

export function portPrices(zone: ZoneDef, portId: string, t: number, commerce: number) {
  const port = zone.ports.find((p) => p.id === portId) ?? zone.ports[0];
  const out: Partial<Record<GoodId, { buy: number; sell: number }>> = {};
  for (const g of Object.values(GOODS)) {
    const p = goodPrice(port, g.id, g.base, t, zone.seed);
    out[g.id] = { buy: Math.ceil(p * 1.06 * (1 - 0.03 * commerce)), sell: Math.floor(p * 0.94 * (1 + 0.03 * commerce)) };
  }
  return out;
}

/** Applique un achat. Retourne un message d'erreur, ou null si tout s'est bien passé. */
export function shop(link: PlayerLink, zone: ZoneDef, act: ShopAction, nowSec: number): string | null {
  // Ces actions sont possibles en mer ; les autres demandent d'être à quai.
  const anywhere = ['buyItem', 'useSkin', 'assign', 'recruit', 'eliteShip', 'buyAmmo'];
  if (!anywhere.includes(act.a) && (!link.docked || !link.port)) return 'Vous devez être amarré au port.';
  const p = link.profile;
  const lvl = playerLevel(p);

  switch (act.a) {
    case 'buyShip': {
      const def = SHIP_BY_ID[act.ship];
      if (!def || def.npcOnly) return 'Navire inconnu.';
      if (p.ships.some((s) => s.def === def.id)) return 'Ce navire est déjà dans votre flotte.';
      if (lvl < def.level) return `Il faut être de niveau ${def.level} pour commander ${def.name}.`;
      const c = def.price;
      if ((c.or ?? 0) > p.or || (c.doublons ?? 0) > p.doublons || (c.perles ?? 0) > p.perles) return 'Fonds insuffisants.';
      if (p.ships.length >= 8) return 'Votre flotte est complète (8 navires).';
      p.or -= c.or ?? 0;
      p.doublons -= c.doublons ?? 0;
      p.perles -= c.perles ?? 0;
      const s = giveShip(p, def.id);
      p.active = s.uid;
      link.hpRatio = 1;
      link.sailRatio = 1;
      link.notify(`${def.name} rejoint votre flotte et devient votre navire amiral !`, 'level');
      break;
    }
    case 'selectShip': {
      const s = p.ships.find((x) => x.uid === act.uid);
      if (!s) return 'Navire introuvable.';
      if (p.active !== s.uid) {
        p.active = s.uid;
        link.hpRatio = 1;
        link.sailRatio = 1;
        const cap = activeStats(p).stats.cargo;
        if (cargoUsed(p) > cap) return null; // la cargaison reste, mais on ne pourra plus rien charger
      }
      break;
    }
    case 'upgrade': {
      const s = activeShip(p);
      const slot = act.slot;
      if (!UPGRADE_INFO[slot]) return 'Amélioration inconnue.';
      const cur = s.up[slot];
      if (cur >= MAX_UPGRADE) return 'Niveau maximal atteint.';
      const tier = SHIP_CLASSES[SHIP_BY_ID[s.def].cls].tier;
      const cost = upgradeCost(tier, cur);
      const mat = UPGRADE_INFO[slot].mat;
      if (p.or < cost.or || p.mat[mat] < cost.mat) return 'Ressources insuffisantes.';
      p.or -= cost.or;
      p.mat[mat] -= cost.mat;
      s.up[slot] = cur + 1;
      link.notify(`${UPGRADE_INFO[slot].name} amélioré(e) au niveau ${cur + 1}.`, 'gain');
      break;
    }
    case 'buyAmmo': {
      const a = AMMO[act.ammo];
      if (!a || !a.price) return 'Munition indisponible.';
      if (!pay(p, a.price)) return 'Fonds insuffisants.';
      p.ammo[a.id] = (p.ammo[a.id] ?? 0) + a.pack;
      break;
    }
    case 'buyItem': {
      const it = CONSUMABLES[act.item];
      const qty = Math.max(1, Math.min(20, Math.floor(act.qty) || 1));
      if (!it) return 'Objet inconnu.';
      const total = { or: (it.price.or ?? 0) * qty, perles: (it.price.perles ?? 0) * qty, diamants: (it.price.diamants ?? 0) * qty };
      if (!pay(p, total)) return 'Fonds insuffisants.';
      p.items[it.id] = (p.items[it.id] ?? 0) + qty;
      break;
    }
    case 'repair': {
      const cost = repairCost(link);
      if (cost <= 0) return 'Votre navire est en parfait état.';
      if (p.or < cost) return `La réparation coûte ${fmt(cost)} or.`;
      p.or -= cost;
      link.hpRatio = 1;
      link.sailRatio = 1;
      link.notify(`Les charpentiers de l'arsenal ont remis votre navire à neuf (${fmt(cost)} or).`, 'info');
      break;
    }
    case 'trade': {
      const g = GOODS[act.good];
      const qty = Math.max(1, Math.min(500, Math.floor(act.qty) || 1));
      if (!g) return 'Marchandise inconnue.';
      const price = portPrices(zone, link.port!, nowSec, p.skills.commerce)[g.id]!;
      if (act.buy) {
        const cap = activeStats(p).stats.cargo;
        if (cargoUsed(p) + qty > cap) return `Cale pleine (${cap} tonneaux).`;
        if (p.or < price.buy * qty) return 'Fonds insuffisants.';
        p.or -= price.buy * qty;
        p.cargo[g.id] = (p.cargo[g.id] ?? 0) + qty;
        p.stats.profit -= price.buy * qty;
      } else {
        const have = p.cargo[g.id] ?? 0;
        if (have < qty) return 'Vous n\'avez pas cette quantité à bord.';
        p.cargo[g.id] = have - qty;
        p.or += price.sell * qty;
        p.stats.profit += price.sell * qty;
        p.stats.trades++;
      }
      break;
    }
    case 'skill': {
      if (!(act.skill in p.skills)) return 'Compétence inconnue.';
      if (skillPointsLeft(p) <= 0) return 'Aucun point de compétence disponible.';
      if (p.skills[act.skill] >= MAX_SKILL) return 'Compétence au maximum.';
      p.skills[act.skill]++;
      break;
    }
    case 'exchange': {
      // Change : 10 doublons -> 1 perle, 10 perles -> 1 diamant (aucun achat en argent réel).
      if (act.what === 'perles') {
        if (p.perles < 10) return 'Il faut 10 perles.';
        p.perles -= 10;
        p.diamants += 1;
      } else {
        if (p.doublons < 10) return 'Il faut 10 doublons.';
        p.doublons -= 10;
        p.perles += 1;
      }
      break;
    }
    case 'buyEquip': {
      const qty = Math.max(1, Math.min(200, Math.floor(act.qty) || 1));
      const d = isCannon(act.item) ? CANNONS[act.item] : isMast(act.item) ? MASTS[act.item] : null;
      if (!d) return 'Équipement inconnu.';
      const c = { or: (d.price.or ?? 0) * qty, perles: (d.price.perles ?? 0) * qty, diamants: (d.price.diamants ?? 0) * qty };
      if (c.or > p.or || c.perles > p.perles || c.diamants > p.diamants) return 'Fonds insuffisants.';
      p.or -= c.or; p.perles -= c.perles; p.diamants -= c.diamants;
      p.equip[act.item] = (p.equip[act.item] ?? 0) + qty;
      break;
    }
    case 'install':
    case 'uninstall': {
      const id = act.item;
      if (!isCannon(id) && !isMast(id)) return 'Équipement inconnu.';
      const s = activeShip(p);
      const def = SHIP_BY_ID[s.def];
      s.fit = s.fit ?? {};
      let qty = Math.max(1, Math.min(500, Math.floor(act.qty) || 1));
      if (act.a === 'install') {
        const cap = isCannon(id) ? def.canons : MAST_CAPACITY[def.cls];
        const free = cap - fitCount(s.fit, isCannon(id) ? 'canon' : 'mat');
        qty = Math.min(qty, free, p.equip[id] ?? 0);
        if (qty <= 0) return free <= 0 ? 'Capacité du navire atteinte : retirez d\'abord de l\'équipement.' : 'Rien en stock.';
        p.equip[id] = (p.equip[id] ?? 0) - qty;
        s.fit[id] = (s.fit[id] ?? 0) + qty;
      } else {
        qty = Math.min(qty, s.fit[id] ?? 0);
        if (qty <= 0) return 'Rien à retirer.';
        s.fit[id] = (s.fit[id] ?? 0) - qty;
        p.equip[id] = (p.equip[id] ?? 0) + qty;
      }
      break;
    }
    case 'sellFish':
      return sellFish(link, p.skills.commerce) ?? (link.touch(), null);
    case 'buySkin': {
      const sk = SKINS[act.skin];
      if (!sk) return 'Pont inconnu.';
      if (p.skins.includes(sk.id)) return 'Vous possédez déjà ce pont.';
      if (!pay(p, sk.price)) return 'Fonds insuffisants.';
      p.skins.push(sk.id);
      p.skin = sk.id;
      link.notify(`${sk.name} installé sur votre navire !`, 'level');
      break;
    }
    case 'useSkin':
      if (act.skin && !p.skins.includes(act.skin)) return 'Vous ne possédez pas ce pont.';
      p.skin = act.skin;
      break;
    case 'forge': {
      const i = Math.floor(act.slot);
      const slot = FORGE[i];
      if (!slot) return 'Emplacement inconnu.';
      if (p.forge[i]) return 'Ce pont est déjà forgé.';
      if (i > 0 && !p.forge[i - 1]) return `Forgez d'abord le pont ${i}.`;
      if (p.ferraille < slot.ferraille || p.or < slot.or) return `Il faut ${slot.ferraille} ferraille et ${fmt(slot.or)} or.`;
      p.ferraille -= slot.ferraille;
      p.or -= slot.or;
      if (Math.random() < slot.chance) {
        p.forge[i] = true;
        link.notify(`Le matelot de pont a réussi ! Pont ${slot.n} forgé : ${slot.label}.`, 'level');
      } else {
        link.notify(`La mer est impitoyable : la forge du pont ${slot.n} a échoué, la ferraille est perdue.`, 'warn');
      }
      break;
    }
    case 'recruit': {
      const c = CAPTAIN_BY_ID[act.captain];
      if (!c) return 'Capitaine inconnu.';
      if (p.captains.includes(c.id)) return 'Ce capitaine sert déjà sous vos ordres.';
      if (!pay(p, c.price)) return 'Fonds insuffisants.';
      p.captains.push(c.id);
      p.captainsActive[c.cat] = c.id;
      link.notify(`${c.name} rejoint votre état-major !`, 'level');
      break;
    }
    case 'assign': {
      if (act.captain && !p.captains.includes(act.captain)) return 'Capitaine non recruté.';
      if (act.captain && CAPTAIN_BY_ID[act.captain].cat !== act.cat) return 'Mauvaise catégorie.';
      p.captainsActive[act.cat] = act.captain;
      break;
    }
    case 'eliteShip': {
      const def = SHIP_BY_ID[act.ship];
      if (!def?.elite) return 'Navire élite inconnu.';
      if (p.elite < def.elite) return `Il faut ${fmt(def.elite)} points élite.`;
      const own = p.ships.find((s) => s.def === def.id);
      if (own) { p.active = own.uid; }
      else {
        if (p.ships.length >= 12) return 'Flotte complète.';
        const s = giveShip(p, def.id);
        p.active = s.uid;
        link.notify(`${def.name} rejoint votre flotte d'élite !`, 'level');
      }
      link.hpRatio = 1;
      link.sailRatio = 1;
      break;
    }
    default:
      return 'Action inconnue.';
  }
  link.touch();
  return null;
}

function pay(p: PlayerLink['profile'], price: { or?: number; perles?: number; diamants?: number }) {
  if ((price.or ?? 0) > p.or || (price.perles ?? 0) > p.perles || (price.diamants ?? 0) > p.diamants) return false;
  p.or -= price.or ?? 0; p.perles -= price.perles ?? 0; p.diamants -= price.diamants ?? 0;
  return true;
}

export function repairCost(link: PlayerLink) {
  const { stats, tier } = activeStats(link.profile);
  const missing = (1 - link.hpRatio) * stats.hp + (1 - link.sailRatio) * stats.sailHp * 0.5;
  return Math.ceil(missing * (0.25 + tier * 0.05));
}

export function acceptMission(link: PlayerLink, offers: MissionOffer[], id: string): string | null {
  const p = link.profile;
  const o = offers.find((x) => x.id === id);
  if (!o) return 'Mission indisponible.';
  if (p.missions.some((m) => m.id === id)) return 'Mission déjà acceptée.';
  if (p.missions.length >= 3) return 'Vous avez déjà 3 missions en cours.';
  if (o.cargo) {
    const cap = activeStats(p).stats.cargo;
    if (cargoUsed(p) + o.cargo.qty > cap) return 'Pas assez de place dans la cale pour cette livraison.';
    p.cargo[o.cargo.good] = (p.cargo[o.cargo.good] ?? 0) + o.cargo.qty;
  }
  p.missions.push({ ...o, progress: 0 });
  link.touch();
  return null;
}
