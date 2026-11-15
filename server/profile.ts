// Profil joueur côté serveur : création, validation au chargement, statistiques du navire actif.
import crypto from 'node:crypto';
import { AMMO_ORDER, CONSUMABLE_ORDER } from '../shared/items.ts';
import { EQUIP_ORDER, type EquipId } from '../shared/equipment.ts';
import { CAPTAIN_BY_ID, DAILY_BY_ID, shipBonus, SKINS } from '../shared/extras.ts';
import { levelFromXp } from '../shared/progression.ts';
import type { FlagChoice, OwnedShip, Profile } from '../shared/protocol.ts';
import { computeStats, NO_SKILLS, NO_UPGRADES, SHIP_BY_ID, SHIP_CLASSES } from '../shared/ships.ts';
import { migrateZoneId, START_ZONE, ZONE_BY_ID } from '../shared/zones.ts';

export const newUid = () => crypto.randomBytes(6).toString('hex');

function cleanCounts(o: unknown): Partial<Record<EquipId, number>> {
  const out: Partial<Record<EquipId, number>> = {};
  if (!o || typeof o !== 'object') return out;
  for (const id of EQUIP_ORDER) {
    const v = Math.floor(Number((o as Record<string, unknown>)[id]) || 0);
    if (v > 0) out[id] = v;
  }
  return out;
}

export function newProfile(name: string): Profile {
  return {
    name,
    created: false,
    portrait: 0,
    flag: 'royal',
    xp: 0,
    reputation: 0,
    or: 2500,
    doublons: 10,
    perles: 2,
    diamants: 0,
    equip: { c30: 10, pin: 4 },
    mat: { bois: 10, toile: 10, fer: 10 },
    ships: [],
    active: '',
    ammo: { rond: 0, chaine: 25, mitraille: 25, rouge: 25, explosif: 5, perle: 10, diamant: 0 },
    items: { kit: 3, seau: 3, poudre: 1 },
    cargo: {},
    skills: { ...NO_SKILLS },
    zone: START_ZONE,
    port: ZONE_BY_ID[START_ZONE].ports[0].id,
    missions: [],
    discovered: [],
    stats: { kills: 0, pvp: 0, deaths: 0, damage: 0, treasures: 0, trades: 0, boss: 0, profit: 0 },
    guild: null,
    tier: 1,
    tierKills: 0,
    shootXp: 0,
    fishXp: 0,
    fish: {},
    elite: 0,
    ferraille: 20,
    forge: [false, false, false, false, false, false, false, false],
    skins: [],
    skin: null,
    captains: [],
    captainsActive: {},
    daily: { active: [], cooldown: {} },
    buffs: {},
    battleClaimed: 0,
    fishClaimed: 0,
    activeOther: '',
    levelMission: { level: 1, progress: 0 },
  };
}

export function giveShip(p: Profile, defId: string): OwnedShip {
  const s: OwnedShip = { uid: newUid(), def: defId, up: { ...NO_UPGRADES } };
  p.ships.push(s);
  return s;
}

/** Répare un profil chargé depuis la base (champs manquants après une mise à jour, valeurs aberrantes). */
export function sanitizeProfile(raw: Profile, name: string): Profile {
  const base = newProfile(name);
  const p: Profile = { ...base, ...raw, name };
  p.mat = { ...base.mat, ...(raw.mat || {}) };
  p.ammo = { ...base.ammo, ...(raw.ammo || {}) };
  p.items = { ...base.items, ...(raw.items || {}) };
  p.skills = { ...NO_SKILLS, ...(raw.skills || {}) };
  p.stats = { ...base.stats, ...(raw.stats || {}) };
  p.ships = (raw.ships || []).filter((s) => SHIP_BY_ID[s.def] && !SHIP_BY_ID[s.def].npcOnly).map((s) => ({ ...s, up: { ...NO_UPGRADES, ...s.up }, fit: cleanCounts(s.fit) }));
  p.equip = cleanCounts(raw.equip);
  p.diamants = Math.max(0, Math.floor(raw.diamants || 0));
  p.zone = migrateZoneId(p.zone);
  p.tier = Math.max(1, Math.floor(raw.tier || 1), ZONE_BY_ID[p.zone].tier);
  p.tierKills = Math.max(0, Math.floor(raw.tierKills || 0));
  p.forge = Array.from({ length: 8 }, (_, i) => !!raw.forge?.[i]);
  p.skins = (raw.skins || []).filter((x) => x in SKINS);
  if (p.skin && !p.skins.includes(p.skin)) p.skin = null;
  p.captains = (raw.captains || []).filter((x) => CAPTAIN_BY_ID[x]);
  p.captainsActive = Object.fromEntries(Object.entries(raw.captainsActive || {}).filter(([, v]) => !v || p.captains.includes(v)));
  p.daily = { active: (raw.daily?.active || []).filter((d) => DAILY_BY_ID[d.id]), cooldown: raw.daily?.cooldown || {} };
  p.levelMission = raw.levelMission || base.levelMission;
  p.fish = raw.fish || {};
  p.buffs = raw.buffs || {};
  for (const m of p.missions) m.zone = migrateZoneId(m.zone);
  if (!ZONE_BY_ID[p.zone].ports.some((x) => x.id === p.port)) p.port = ZONE_BY_ID[p.zone].ports[0].id;
  if (p.created && !p.ships.length) giveShip(p, 'bayonnaise');
  if (!p.ships.some((s) => s.uid === p.active)) p.active = p.ships[0]?.uid ?? '';
  for (const k of AMMO_ORDER) p.ammo[k] = Math.max(0, Math.floor(p.ammo[k] || 0));
  for (const k of CONSUMABLE_ORDER) p.items[k] = Math.max(0, Math.floor(p.items[k] || 0));
  p.missions = Array.isArray(raw.missions) ? raw.missions.slice(0, 3) : [];
  p.discovered = Array.isArray(raw.discovered) ? raw.discovered.slice(0, 2000) : [];
  return p;
}

export function createCharacter(p: Profile, portrait: number, flag: FlagChoice, ship: string) {
  p.created = true;
  p.portrait = Math.max(0, Math.min(7, Math.floor(portrait) || 0));
  p.flag = (['royal', 'tricolore', 'imperial'] as const).includes(flag) ? flag : 'royal';
  const s = giveShip(p, ['bayonnaise', 'mutine', 'saint_michel'].includes(ship) ? ship : 'bayonnaise');
  p.active = s.uid;
}

/** Change d'ère : on mémorise le navire actif et on prend celui de l'autre ère (vedette offerte au premier passage). */
export function switchEra(p: Profile, toModern: boolean): boolean {
  const isModern = (uid: string) => SHIP_BY_ID[p.ships.find((s) => s.uid === uid)?.def ?? '']?.era === 'moderne';
  let next = p.activeOther && p.ships.some((s) => s.uid === p.activeOther) && isModern(p.activeOther) === toModern ? p.activeOther : '';
  if (!next) next = p.ships.find((s) => (SHIP_BY_ID[s.def]?.era === 'moderne') === toModern)?.uid ?? '';
  if (!next && toModern) next = giveShip(p, 'm_vedette_rapide').uid;
  if (!next) return false;
  p.activeOther = p.active;
  p.active = next;
  return true;
}

export const activeShip = (p: Profile) => p.ships.find((s) => s.uid === p.active) ?? p.ships[0];
export const playerLevel = (p: Profile) => levelFromXp(p.xp).level;
export const skillPointsLeft = (p: Profile) => {
  const used = p.skills.artillerie + p.skills.navigation + p.skills.charpenterie + p.skills.commerce;
  return Math.max(0, playerLevel(p) - 1 - used);
};

export function activeStats(p: Profile) {
  const s = activeShip(p);
  const def = SHIP_BY_ID[s.def];
  return { def, stats: computeStats(def, s.up, p.skills, s.fit, shipBonus(p, def)), tier: SHIP_CLASSES[def.cls].tier };
}

export function cargoUsed(p: Profile) {
  return Object.values(p.cargo).reduce((a, b) => a + (b || 0), 0);
}
