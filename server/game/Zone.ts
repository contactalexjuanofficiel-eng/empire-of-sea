// Simulation autoritaire d'une zone maritime : un « shard » indépendant.
// Le serveur peut faire tourner chaque zone dans son propre processus plus tard (voir docs/ARCHITECTURE.md).
import { FLEET_BONUS_MAX, FLEET_BONUS_PER_ALLY, FLEET_BONUS_RADIUS, FLEET_SPACING } from '../../shared/fleet.ts';
import { REGION_BY_ID } from '../../shared/regions.ts';
import { skillCooldownMul, skillPower, ACTIVE_SKILL_BY_ID, BASE_CRIT, CRIT_MUL, ENERGY_MAX, ENERGY_REGEN, SHIELD_DELAY, SHIELD_RATIO, SHIELD_REGEN, SKILL_CRIT_BONUS, SKILL_DMG_BONUS, type ActiveSkillId } from '../../shared/combat.ts';
import { AMMO, CONSUMABLES, type AmmoId, type ConsumableId } from '../../shared/items.ts';
import type { EquipId } from '../../shared/equipment.ts';
import { clamp, dist2, wrapAngle } from '../../shared/math.ts';
import { combatHelm, steerTo } from '../../shared/autopilot.ts';
import { collideShip, elevationFor, GRAVITY, stepShip, type Wind } from '../../shared/physics.ts';
import {
  F_BURNING, F_PVP, F_REPAIRING, F_SAFE, F_SINKING, VIEW_RADIUS,
  type Ball, type EntityMeta, type EntityState, type GameEvent, type MeState, type Side, type WeatherState,
} from '../../shared/protocol.ts';
import { computeStats, SHIP_BY_ID, SHIP_CLASSES, type ShipDef } from '../../shared/ships.ts';
import { buildWorld, terrainHeight, type ZoneWorld } from '../../shared/world.ts';
import { DOCK_RADIUS, PORT_SAFE_RADIUS, type Faction, type ZoneDef } from '../../shared/zones.ts';
import { activeStats, playerLevel } from '../profile.ts';
import type { PlayerLink, Relation } from '../types.ts';
import { newWaypoint, thinkNPC } from './ai.ts';
import type { FortEnt, LootEnt, Projectile, ShipEnt } from './entities.ts';
import { grant, progressMission } from './rewards.ts';
import { BATTLE_STEPS, battlePoints, battleThreshold, stepOf } from '../../shared/ranks.ts';
import { onDamage, onLoot, onNpcKill, onPlayerKill, tickFishing } from './progress.ts';

let nextId = 1;
export const allocId = () => nextId++;

export const DAY_SECONDS = 1200;
const SINK_TIME = 9;
const RESPAWN_TIME = 6;
const BOSS_INTERVAL = 420;
const BOSS_LIFETIME = 600;

const NPC_NAMES: Record<string, string[]> = {
  pirate: ['La Vipère Noire', 'Le Requin', 'La Veuve', 'Le Charognard', 'La Gueuse', 'Le Sans-Pitié', 'La Rascasse', 'Le Corbeau'],
  anglais: ['HMS Resolute', 'HMS Defiance', 'HMS Thunderer', 'HMS Audacious', 'HMS Valiant', 'HMS Implacable', 'HMS Swiftsure'],
  barbaresque: ['Le Croissant Rouge', 'L\'Épervier d\'Alger', 'Le Faucon de Tunis', 'Le Lion de Salé', 'La Lame d\'Or'],
  flibustier: ['La Revanche', 'Le Fléau des Mers', 'La Hache Sanglante', 'Le Bâtard des Îles', 'La Fortune Noire'],
  spectre: ['Le Vaisseau Pâle', 'L\'Âme Errante', 'Le Linceul', 'La Dame Grise'],
};

export interface ZoneHooks {
  relation(a: PlayerLink, b: PlayerLink): Relation;
  broadcastChat?(text: string): void;
  /** Un boss vient d'être vaincu : la guilde du meilleur capitaine prend le contrôle de la carte. */
  onConquest?(zone: Zone, link: PlayerLink): void;
  /** Un PNJ a été coulé par ce joueur (mission de passage d'étage). */
  onKill?(zone: Zone, link: PlayerLink): void;
  /** Un capitaine en a coulé un autre (points de raid). */
  onPvpKill?(zone: Zone, killer: PlayerLink, victim: PlayerLink): void;
}

export class Zone {
  readonly def: ZoneDef;
  readonly world: ZoneWorld;
  /** Raid PvP en cours sur cette carte : combat libre pour tous (hors des ports). */
  raidActive = false;
  readonly ships = new Map<number, ShipEnt>();
  readonly forts = new Map<number, FortEnt>();
  readonly loot = new Map<number, LootEnt>();
  readonly links = new Map<number, PlayerLink>();
  private projectiles: Projectile[] = [];
  private events: { ev: GameEvent; x: number; z: number }[] = [];
  wind: Wind = { dir: 0.6, strength: 0.85 };
  private windTarget = 0.6;
  weather: WeatherState = { kind: 'clair', intensity: 0, fog: 1 };
  private weatherTimer = 120;
  private nextWeather: WeatherState['kind'] = 'clair';
  time = 0;
  /** Réapparition des PNJ : chaque navire coulé revient 5 minutes plus tard (type tiré au sort). */
  private respawns: number[] = [];
  /** Cartes bonus : navires coulés depuis le dernier boss, dégâts cumulés par joueur sur le boss. */
  bonusKills = 0;
  private bonusDmg = new Map<number, number>();
  /** Coffres flottants : récompense tirée au sort, réapparition ailleurs 60 à 120 s après ouverture. */
  private chestTimers: number[] = [];
  get chestTarget() { return 8 + this.def.tier; }
  static NPC_RESPAWN = 300;
  private bossTimer = 150;
  bossId = 0;
  private bossAge = 0;
  private emptyFor = 0;
  private wreckTimers = new Map<number, number>();

  constructor(def: ZoneDef, private hooks: ZoneHooks) {
    this.def = def;
    this.world = buildWorld(def);
    for (const f of this.world.forts) {
      const lvl = f.faction === 'france' ? def.levels[1] + 5 : def.levels[0] + 2;
      const maxHp = f.faction === 'france' ? 1e9 : 3500 * (1 + lvl * 0.12);
      this.forts.set(allocId(), { id: 0, def: f, hp: maxHp, maxHp, reload: Math.random() * 4, range: f.faction === 'france' ? 620 : 480, dmg: 90 * (1 + lvl * 0.09), level: lvl, down: 0, dmgBy: new Map() });
    }
    for (const [id, f] of this.forts) f.id = id;
    for (let i = 0; i < def.npcCount; i++) this.spawnNPC(true);
    for (const w of this.world.wrecks) this.spawnTreasure(w.id);
    for (let i = 0; i < this.chestTarget; i++) this.spawnChest();
    this.wind.dir = Math.random() * Math.PI * 2;
    this.windTarget = this.wind.dir;
  }

  // ------------------------------------------------------------------ joueurs
  /** Place un navire en mer près du port principal (changement de carte en pleine mer). */
  arriveAtSea(link: PlayerLink) {
    link.port = this.def.ports.find((p) => p.main)?.id ?? this.def.ports[0].id;
    this.undock(link);
  }

  /** Arrivée sur la carte : il n'y a plus d'accostage, le navire est toujours en mer (devant le port de la carte). */
  addPlayer(link: PlayerLink, _legacyDocked = false) {
    link.zoneId = this.def.id;
    link.known.clear();
    this.links.set(link.entityId, link);
    if (!this.def.ports.some((p) => p.id === link.port)) link.port = this.def.ports.find((p) => p.main)?.id ?? this.def.ports[0].id;
    link.docked = true;
    this.undock(link);
  }

  /** Remplace le navire en mer, sur place (changement de navire depuis le chantier). */
  swapShip(link: PlayerLink) {
    const old = this.ships.get(link.entityId);
    if (!old || old.sinking >= 0) return;
    const { def, stats, tier } = activeStats(link.profile);
    const s = this.makeShip(link.entityId, 'player', def, stats, playerLevel(link.profile), 'france', link.name, old.k.x, old.k.z, old.k.h);
    s.tier = tier;
    s.link = link;
    s.ammo = link.profile.ammo[old.ammo] > 0 ? old.ammo : 'rond';
    s.energy = old.energy;
    this.ships.set(s.id, s);
    for (const l of this.links.values()) l.known.delete(s.id); // tout le monde reçoit la nouvelle fiche du navire
  }

  removePlayer(link: PlayerLink) {
    const s = this.ships.get(link.entityId);
    if (s && s.sinking < 0) {
      link.hpRatio = s.hp / s.stats.hp;
      link.sailRatio = s.sailHp / s.stats.sailHp;
    }
    this.ships.delete(link.entityId);
    this.links.delete(link.entityId);
  }

  nearestPort(x: number, z: number) {
    let best = this.def.ports[0], bd = Infinity;
    for (const p of this.def.ports) {
      const d = dist2(x, z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  undock(link: PlayerLink): string | null {
    if (!link.docked || link.deadTimer > 0) return 'Impossible pour le moment.';
    const port = this.def.ports.find((p) => p.id === link.port) ?? this.def.ports[0];
    const dock = this.world.docks[port.id];
    const { def, stats, tier } = activeStats(link.profile);
    const s = this.makeShip(link.entityId, 'player', def, stats, playerLevel(link.profile), 'france', link.name, dock.x, dock.z, dock.h);
    s.tier = tier;
    s.hp = Math.max(1, stats.hp * clamp(link.hpRatio, 0.05, 1));
    s.sailHp = stats.sailHp * clamp(link.sailRatio, 0.05, 1);
    s.link = link;
    s.ammo = link.profile.ammo[s.ammo] > 0 ? s.ammo : 'rond';
    this.ships.set(s.id, s);
    link.docked = false;
    link.input = { sail: 0, rudder: 0 }; // le navire attend les ordres (il n'avance plus tout seul)
    link.nav = null;
    link.known.clear();
    return null;
  }

  dock(link: PlayerLink): string | null {
    const s = this.ships.get(link.entityId);
    if (!s || s.sinking >= 0) return 'Aucun navire à amarrer.';
    const port = this.nearestPort(s.k.x, s.k.z);
    const dock = this.world.docks[port.id];
    if (dist2(s.k.x, s.k.z, dock.x, dock.z) > DOCK_RADIUS * DOCK_RADIUS) return `Approchez-vous du port de ${port.name} pour accoster.`;
    if (this.time - s.lastHit < 8) return 'Impossible d\'accoster en plein combat !';
    link.hpRatio = s.hp / s.stats.hp;
    link.sailRatio = s.sailHp / s.stats.sailHp;
    this.ships.delete(s.id);
    link.docked = true;
    link.nav = null;
    link.attacking = false;
    link.targetId = 0;
    link.port = port.id;
    link.profile.port = port.id;
    // Livraisons à destination de ce port.
    for (const m of [...link.profile.missions]) {
      if (m.type === 'livraison' && m.target === port.id && m.cargo) {
        const have = link.profile.cargo[m.cargo.good] ?? 0;
        if (have >= m.cargo.qty) {
          link.profile.cargo[m.cargo.good] = have - m.cargo.qty;
          progressMission(link, 'livraison', port.id, 1);
        } else {
          link.notify(`Il manque des marchandises pour la livraison « ${m.title} ».`, 'warn');
        }
      }
    }
    link.touch();
    return null;
  }

  /** Rafraîchit les stats du navire en mer (après une amélioration, par exemple). */
  refreshShip(link: PlayerLink) {
    const s = this.ships.get(link.entityId);
    if (!s) return;
    const { stats } = activeStats(link.profile);
    const r = s.hp / s.stats.hp;
    s.stats = stats;
    s.hp = stats.hp * r;
    const sr = s.shieldMax ? s.shield / s.shieldMax : 1;
    s.shieldMax = stats.hp * SHIELD_RATIO;
    s.shield = s.shieldMax * sr;
  }

  // ------------------------------------------------------------------ fabrique
  private makeShip(id: number, kind: ShipEnt['kind'], def: ShipDef, stats: ShipEnt['stats'], level: number, faction: Faction, name: string, x: number, z: number, h: number): ShipEnt {
    return {
      id, kind, def, stats, level, faction, name,
      k: { x, z, h, speed: 0 },
      input: { sail: 0, rudder: 0 },
      hp: stats.hp, sailHp: stats.sailHp,
      reload: [0, 0], ammo: 'rond', burning: 0, repairing: 0, powder: 0, crewPenalty: 0,
      cd: {}, fx: { speed: 0, shield: 0, slow: 0, smoke: 0, dmg: 0, crit: 0 },
      shieldMax: kind === 'player' ? stats.hp * SHIELD_RATIO : 0, shield: kind === 'player' ? stats.hp * SHIELD_RATIO : 0,
      energy: ENERGY_MAX, skillCd: {},
      sinking: -1, dmgBy: new Map(), lastHit: -999, tier: SHIP_CLASSES[def.cls].tier, dmgMul: 1,
    };
  }

  private randomSeaPoint(minPortDist: number, minPlayerDist: number): { x: number; z: number } {
    const H = this.def.half - 400;
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() * 2 - 1) * H, z = (Math.random() * 2 - 1) * H;
      if (terrainHeight(this.world, x, z) > -8) continue;
      if (this.def.ports.some((p) => dist2(p.x, p.z, x, z) < minPortDist * minPortDist)) continue;
      let near = false;
      for (const s of this.ships.values()) if (s.kind === 'player' && dist2(s.k.x, s.k.z, x, z) < minPlayerDist * minPlayerDist) { near = true; break; }
      if (near && i < 30) continue;
      return { x, z };
    }
    return { x: 0, z: 0 };
  }

  spawnNPC(initial = false) {
    const total = this.def.enemies.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total;
    let sp = this.def.enemies[0];
    for (const e of this.def.enemies) { r -= e.weight; if (r <= 0) { sp = e; break; } }
    const def = SHIP_BY_ID[sp.ship];
    const level = sp.level + Math.floor(Math.random() * 3);
    const upLvl = Math.min(5, Math.floor(level / 8));
    const stats = computeStats(def, { coque: upLvl, voiles: upLvl, canons: upLvl, boulets: upLvl });
    stats.hp = Math.round(stats.hp * (1 + 0.03 * Math.max(0, level - def.level)));
    stats.sailHp = Math.round(stats.hp * 0.5);
    const pos = this.randomSeaPoint(1500, initial ? 0 : 900);
    const names = NPC_NAMES[sp.faction] ?? NPC_NAMES.pirate;
    const s = this.makeShip(allocId(), 'npc', def, stats, level, sp.faction, names[Math.floor(Math.random() * names.length)], pos.x, pos.z, Math.random() * 6.28);
    s.dmgMul = 0.62;
    s.ammo = sp.faction === 'barbaresque' ? 'mitraille' : Math.random() < 0.15 ? 'rouge' : 'rond';
    s.ai = { mode: 'patrouille', target: 0, wx: pos.x, wz: pos.z, think: Math.random(), homeX: pos.x, homeZ: pos.z, aggro: 650 + level * 6, accuracy: clamp(0.35 + level * 0.02, 0, 0.85), side: 1 };
    newWaypoint(this, s);
    this.ships.set(s.id, s);
  }

  private spawnBoss() {
    const bonus = this.def.bonus;
    // Boss de la carte : celui de la carte bonus, sinon le boss de la grande région.
    const reg = REGION_BY_ID[this.def.region ?? 'france'];
    const def = bonus ? SHIP_BY_ID[bonus.boss] : SHIP_BY_ID[reg.boss.ship] ?? SHIP_BY_ID.spectre;
    const level = this.def.levels[1] + (bonus ? 5 : 0);
    const stats = computeStats(def, { coque: 2, voiles: 0, canons: 2, boulets: 2 });
    const scale = (0.35 + level / 22) * (bonus ? 8 : 1);
    stats.hp = Math.round(stats.hp * scale);
    stats.sailHp = Math.round(stats.hp * 0.5);
    const pos = this.randomSeaPoint(2000, 700);
    const bossName = bonus?.bossName ?? def.name;
    const s = this.makeShip(allocId(), 'boss', def, stats, level, bonus ? 'pirate' : reg.boss.faction, bossName, pos.x, pos.z, Math.random() * 6.28);
    s.dmgMul = bonus ? 0.9 : 0.22 * scale + 0.1;
    s.ai = { mode: 'patrouille', target: 0, wx: pos.x, wz: pos.z, think: 0, homeX: pos.x, homeZ: pos.z, aggro: 1500, accuracy: 0.7, side: 1 };
    newWaypoint(this, s);
    this.ships.set(s.id, s);
    this.bossId = s.id;
    this.bossAge = 0;
    const msg = bonus
      ? `${bossName} apparaît sur ${this.def.name} ! Chaque tranche de 10 000 dégâts rapporte ${bonus.per10k.elite} points élite et ${bonus.per10k.xp} XP.`
      : `${this.def.name} : ${reg.boss.announce.replace('{boss}', def.name)}`;
    for (const l of this.links.values()) {
      l.notify(msg, 'event');
      l.send({ t: 'boss', active: true, hp: s.hp, maxHp: s.stats.hp, name: bossName, x: Math.round(pos.x), z: Math.round(pos.z) });
    }
    if (bonus) { this.bonusKills = 0; return; }
    this.weather = { kind: 'brume', intensity: 1, fog: 3 };
    this.nextWeather = 'brume';
    this.weatherTimer = 200;
  }

  /** Équipement trouvé dans les épaves : plus la carte est haute, plus les gros calibres sont fréquents. */
  private equipDrop(luck: number): Partial<Record<EquipId, number>> {
    const t = this.def.tier, R = Math.random, out: Partial<Record<EquipId, number>> = {};
    if (R() < 0.25 * luck) out.c30 = 1 + Math.floor(R() * (2 + t));
    if (R() < 0.12 * luck) out.pin = 1 + Math.floor(R() * 3);
    if (t >= 2 && R() < 0.05 * luck * t / 2) out.c50 = 1 + Math.floor(R() * 2);
    if (t >= 3 && R() < 0.04 * luck * t / 3) out.chene = 1 + Math.floor(R() * 2);
    if (t >= 5 && R() < 0.02 * luck * t / 5) out.c60 = 1;
    if (t >= 6 && R() < 0.02 * luck * t / 6) out.riga = 1;
    return out;
  }

  private spawnChest() {
    const pos = this.randomSeaPoint(300, 0);
    const R = Math.random, t = this.def.tier;
    const id = allocId();
    const l: LootEnt = { id, x: pos.x, z: pos.z, kind: 'coffre', or: 0, doublons: 0, perles: 0, diamants: 0, equip: {}, mat: { bois: 0, toile: 0, fer: 0 }, expires: Infinity, xp: 0 };
    const roll = R();
    l.or = Math.round((80 + R() * 200) * (1 + t * 0.3));
    if (roll < 0.35) l.or += Math.round((300 + R() * 1200) * (1 + t * 0.4));
    else if (roll < 0.55) l.xp = Math.round((150 + R() * 450) * (1 + t * 0.5));
    else if (roll < 0.7) l.perles = 1 + Math.floor(R() * 3);
    else if (roll < 0.82) l.doublons = 3 + Math.floor(R() * 8);
    else if (roll < 0.94) l.equip = this.equipDrop(3);
    else l.diamants = 1 + (R() < 0.2 ? 1 : 0);
    if (R() < 0.3) l.mat = { bois: Math.floor(R() * 4), toile: Math.floor(R() * 4), fer: Math.floor(R() * 3) };
    this.loot.set(id, l);
  }

  private spawnTreasure(wreckId: number) {
    const w = this.world.wrecks.find((x) => x.id === wreckId);
    if (!w) return;
    const lvl = this.def.levels[0];
    const id = allocId();
    this.loot.set(id, {
      id, x: w.x + Math.sin(w.h) * 22, z: w.z + Math.cos(w.h) * 22, kind: 'tresor',
      or: Math.round((500 + Math.random() * 900) * (1 + lvl * 0.3)), doublons: 2 + Math.floor(Math.random() * 6), perles: Math.random() < 0.35 ? 1 + Math.floor(Math.random() * 3) : 0,
      diamants: Math.random() < 0.08 * this.def.tier ? 1 : 0,
      equip: this.equipDrop(1.5),
      mat: { bois: 3 + Math.floor(Math.random() * 6), toile: 3 + Math.floor(Math.random() * 6), fer: 2 + Math.floor(Math.random() * 5) },
      expires: Infinity, wreck: wreckId,
    });
  }

  // ------------------------------------------------------------------ règles
  inSafeZone(x: number, z: number) {
    for (const p of this.def.ports) if (dist2(x, z, p.x, p.z) < PORT_SAFE_RADIUS * PORT_SAFE_RADIUS) return true;
    return false;
  }

  /** Qui peut endommager qui ? Toutes les règles d'hostilité sont ici. */
  canHarm(a: ShipEnt | FortEnt, b: ShipEnt | FortEnt): boolean {
    if (a === b) return false;
    const aShip = 'k' in a, bShip = 'k' in b;
    const af: Faction = aShip ? (a as ShipEnt).faction : (a as FortEnt).def.faction;
    const bf: Faction = bShip ? (b as ShipEnt).faction : (b as FortEnt).def.faction;
    if (!bShip) {
      // Seuls les repaires pirates peuvent être attaqués, et seulement par des joueurs.
      return (b as FortEnt).def.faction === 'pirate' && aShip && (a as ShipEnt).kind === 'player';
    }
    const B = b as ShipEnt;
    if (B.sinking >= 0) return false;
    if (!aShip) {
      const fa = (a as FortEnt).def.faction;
      if (fa === 'france') return B.kind !== 'player';
      return B.kind === 'player';
    }
    const A = a as ShipEnt;
    if (A.kind !== 'player' && B.kind !== 'player') return false; // les PNJ ne se battent pas entre eux
    if (A.kind !== 'player') return !this.inSafeZone(B.k.x, B.k.z) && af !== bf;
    if (B.kind !== 'player') return true;
    // Joueur contre joueur
    if (this.inSafeZone(A.k.x, A.k.z) || this.inSafeZone(B.k.x, B.k.z)) return false;
    const rel = this.hooks.relation(A.link!, B.link!);
    if (rel === 'friend') return false;
    if (rel === 'war') return true;
    if (this.def.pvp === 'libre' || this.raidActive) return true;
    return A.link!.pvp && B.link!.pvp;
  }

  // ------------------------------------------------------------------ actions
  /** Morsure d'un monstre marin (dégâts au contact). */
  bite(s: ShipEnt, tgt: ShipEnt) {
    if (!this.canHarm(s, tgt)) return;
    const dmg = (60 + s.level * 24) * (s.def.look.monster === 'leviathan' || s.def.look.monster === 'kraken' ? 1.6 : 1);
    s.reload[0] = 1.6;
    const y = 3 + Math.random() * 3;
    this.emit({ k: 'hit', pid: 0, id: tgt.id, x: r1(tgt.k.x), y, z: r1(tgt.k.z), dmg: Math.round(dmg * (1 - tgt.stats.armor)), by: s.id, crit: Math.random() < 0.15 }, tgt.k.x, tgt.k.z);
    this.damage(tgt, dmg, dmg * 0.4, 'rond', s, false);
  }

  /** Facteur de rechargement : une seule batterie qui tire dans toutes les directions. */
  static RELOAD_FACTOR = 0.65;

  /**
   * Salve de canons vers un point, dans n'importe quelle direction : les boulets partent de tout le navire.
   * Le temps de rechargement est unique (reload[0], recopié dans reload[1] pour l'affichage).
   */
  fire(s: ShipEnt, ax: number, az: number) {
    if (s.reload[0] > 0 || s.sinking >= 0 || s.def.look.monster) return;
    let ammoId: AmmoId = s.ammo;
    if (s.link && ammoId !== 'rond') {
      if ((s.link.profile.ammo[ammoId] ?? 0) <= 0) ammoId = s.ammo = 'rond';
      else { s.link.profile.ammo[ammoId]--; s.link.touch(); }
    }
    const ammo = AMMO[ammoId];
    const st = s.stats;
    const yaw = Math.atan2(ax - s.k.x, az - s.k.z);
    const range = st.range * ammo.range;
    const d = clamp(Math.hypot(ax - s.k.x, az - s.k.z), 30, range);
    const v = Math.sqrt((range * GRAVITY) / 0.866);
    const n = st.balls + (ammoId === 'mitraille' ? 3 : 0);
    const dmgEach = (st.broadside * s.dmgMul * (s.powder > 0 ? 1.25 : 1) * (s.fx.dmg > 0 ? 1 + SKILL_DMG_BONUS : 1) * (1 + FLEET_BONUS_PER_ALLY * this.fleetAllies(s))) / n;
    const fx = Math.sin(s.k.h), fz = Math.cos(s.k.h);
    const tx = Math.sin(yaw), tz = Math.cos(yaw);
    const balls: Ball[] = [];
    const pid0 = nextId;
    nextId += n;
    const deck = Math.max(1, SHIP_CLASSES[s.def.cls].gunDecks);
    for (let j = 0; j < n; j++) {
      // Point de départ : n'importe où le long de la coque, côté cible.
      const along = (Math.random() - 0.5) * st.length * 0.7;
      const disp = st.dispersion * ammo.spread;
      const yj = yaw + (Math.random() - 0.5) * 2 * disp;
      const el = elevationFor(d * (1 + (Math.random() - 0.5) * disp * 1.6), v);
      const hv = v * Math.cos(el);
      const ball: Ball = {
        x: s.k.x + fx * along + tx * st.beam * 0.45,
        y: 2.6 + (j % deck) * 2.2,
        z: s.k.z + fz * along + tz * st.beam * 0.45,
        vx: Math.sin(yj) * hv + fx * s.k.speed,
        vy: v * Math.sin(el),
        vz: Math.cos(yj) * hv + fz * s.k.speed,
        d: Math.random() * 0.4,
      };
      balls.push(ball);
      this.projectiles.push({ id: pid0 + j, owner: s.id, ...ball, delay: ball.d, dmg: dmgEach, ammo: ammoId, life: 8 });
    }
    s.reload[0] = s.reload[1] = st.reload * Zone.RELOAD_FACTOR + s.crewPenalty;
    s.crewPenalty = 0;
    this.emit({ k: 'shot', id: s.id, side: 'babord', pid: pid0, ammo: ammoId, t: this.time, balls: balls.map(round) }, s.k.x, s.k.z);
  }

  /**
   * Pilotage d'un navire de joueur : clavier, pilote automatique (clic sur la mer) ou manœuvre d'attaque.
   * L'attaque automatique tire dès que les canons sont rechargés et la cible à portée.
   */
  /**
   * Escadre : le navire suit son chef en formation (en V derrière lui) et attaque la même cible que lui.
   * Un clic du capitaine sur la mer rompt la formation (géré par le Hub).
   */
  private followFleet(s: ShipEnt, link: PlayerLink) {
    let lead: PlayerLink | undefined;
    for (const l of this.links.values()) if (l.name === link.followLeader) { lead = l; break; }
    const L = lead && !lead.docked ? this.ships.get(lead.entityId) : undefined;
    if (!lead || !L || L.sinking >= 0) return;
    // Même cible que le chef.
    if (lead.attacking && lead.targetId) {
      const t = this.ships.get(lead.targetId) ?? this.forts.get(lead.targetId);
      if (t && this.canHarm(s, t)) {
        if (link.targetId !== lead.targetId || !link.attacking) { link.targetId = lead.targetId; link.attacking = true; }
        link.nav = null;
        return;
      }
    }
    if (link.attacking && link.targetId) return;
    // Place dans la formation : rangées de deux, de part et d'autre du sillage du chef.
    const k = Math.max(1, link.fleetSlot);
    const row = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
    const fx = Math.sin(L.k.h), fz = Math.cos(L.k.h);
    const tx = L.k.x - fx * FLEET_SPACING * row + fz * side * FLEET_SPACING * 0.7 * row;
    const tz = L.k.z - fz * FLEET_SPACING * row - fx * side * FLEET_SPACING * 0.7 * row;
    // Chef à l'arrêt : on s'arrête dès qu'on est près de sa place (sinon on tournerait en rond autour).
    const near = L.k.speed < 1.5 ? 110 : 40;
    if (dist2(s.k.x, s.k.z, tx, tz) > near * near) {
      // Vise un peu devant la place (anticipation de la marche du chef).
      link.nav = { x: tx + fx * L.k.speed * 3, z: tz + fz * L.k.speed * 3 };
    } else {
      link.nav = null;
      link.input = { sail: L.k.speed < 1.5 ? 0 : lead.input.sail, rudder: clamp(wrapAngle(s.k.h - L.k.h) * 2, -1, 1) };
    }
  }

  /** Bonus d'escadre : alliés (groupe, guilde, alliance) proches. */
  fleetAllies(s: ShipEnt) {
    if (!s.link) return 0;
    let n = 0;
    for (const o of this.ships.values()) {
      if (o === s || !o.link || o.sinking >= 0) continue;
      if (dist2(s.k.x, s.k.z, o.k.x, o.k.z) > FLEET_BONUS_RADIUS * FLEET_BONUS_RADIUS) continue;
      if (this.hooks.relation(s.link, o.link) === 'friend') n++;
    }
    return Math.min(FLEET_BONUS_MAX, n);
  }

  private pilot(s: ShipEnt, link: PlayerLink) {
    const tgt = link.targetId ? this.ships.get(link.targetId) ?? this.forts.get(link.targetId) : undefined;
    const tShip = tgt && 'k' in tgt ? tgt : null;
    const tx = tShip ? tShip.k.x : tgt ? (tgt as FortEnt).def.x : 0;
    const tz = tShip ? tShip.k.z : tgt ? (tgt as FortEnt).def.z : 0;
    const alive = tgt && (tShip ? tShip.sinking < 0 : (tgt as FortEnt).down <= 0);
    if (link.targetId && (!alive || dist2(s.k.x, s.k.z, tx, tz) > 2600 * 2600)) {
      link.targetId = 0;
      link.attacking = false;
    }
    const range = s.stats.range * AMMO[s.ammo].range;
    if (link.nav) {
      const h = steerTo(this.world, s.k, link.nav.x, link.nav.z);
      if (h) link.input = h;
      else { link.nav = null; link.input = { sail: 0, rudder: 0 }; }
    } else if (link.attacking && alive) {
      link.input = combatHelm(this.world, s.k, s.stats, tx, tz, range);
    }
    // Pêche : navire à l'arrêt, hors combat.
    if (link.fishing) {
      link.input = { sail: 0, rudder: 0 };
      if (!tickFishing(link, s, this.def.tier, this.time - s.lastHit < 8, 1 / 20)) {
        link.fishing = false;
        link.notify('Pêche interrompue.', 'warn');
      }
    }
    s.input = link.input;
    if (link.attacking && alive && tgt && this.canHarm(s, tgt)) {
      const d = Math.sqrt(dist2(s.k.x, s.k.z, tx, tz));
      if (d <= range * 1.02) {
        const flight = d / 110;
        const ax = tShip ? tx + Math.sin(tShip.k.h) * tShip.k.speed * flight : tx;
        const az = tShip ? tz + Math.cos(tShip.k.h) * tShip.k.speed * flight : tz;
        if (s.reload[0] <= 0) this.fire(s, ax, az);
      }
    }
  }

  /** Compétences actives : coûtent de l'énergie et ont un temps de recharge. Renvoie un message d'erreur ou null. */
  useSkill(s: ShipEnt, id: ActiveSkillId): string | null {
    const sk = ACTIVE_SKILL_BY_ID[id];
    if (!sk || !s.link || s.sinking >= 0) return null;
    if (playerLevel(s.link.profile) < sk.level) return `${sk.name} : niveau ${sk.level} requis.`;
    if ((s.skillCd[id] ?? 0) > 0) return `${sk.name} : encore ${Math.ceil(s.skillCd[id]!)} s.`;
    if (s.energy < sk.energy) return `Énergie insuffisante (${sk.energy} requis).`;
    // Niveau fabriqué à l'atelier : effet renforcé, recharge réduite.
    const lv = s.link.profile.skillLv?.[id] ?? 1;
    const k = skillPower(lv);
    s.energy -= sk.energy;
    s.skillCd[id] = sk.cooldown * skillCooldownMul(lv);
    switch (id) {
      case 'bordee': s.reload[0] = 0; s.fx.dmg = sk.duration! * k; break;
      case 'voiles': s.fx.speed = Math.max(s.fx.speed, sk.duration! * k); break;
      case 'reparation': s.hp = Math.min(s.stats.hp, s.hp + s.stats.hp * 0.15 * k * s.stats.repair); break;
      case 'rempart': s.shield = Math.min(s.shieldMax, s.shield + s.shieldMax * Math.min(1, 0.5 * k)); break;
      case 'precision': s.fx.crit = sk.duration! * k; break;
    }
    return null;
  }

  /** Objets de la Boutique de l'Amirauté et équipements de base, utilisés en mer. */
  useItem(s: ShipEnt, id: ConsumableId): string | null {
    const link = s.link!;
    const p = link.profile;
    const it = CONSUMABLES[id];
    if (!it || s.sinking >= 0) return null;
    if ((p.items[id] ?? 0) <= 0) return 'Vous n\'en avez plus : rendez-vous à la Boutique.';
    if ((s.cd[id] ?? 0) > 0) return `${it.name} : encore ${Math.ceil(s.cd[id]!)} s.`;
    if (id === 'seau' && s.burning <= 0) return 'Aucun incendie à bord.';
    let target: ShipEnt | undefined;
    if (it.target) {
      const t = link.targetId ? this.ships.get(link.targetId) : undefined;
      if (!t || t.sinking >= 0 || !this.canHarm(s, t)) return 'Sélectionnez d\'abord une cible ennemie.';
      if (dist2(s.k.x, s.k.z, t.k.x, t.k.z) > (it.range ?? 300) ** 2) return `Cible trop loin (${it.range} m maximum).`;
      target = t;
    }
    p.items[id] = (p.items[id] ?? 0) - 1;
    link.touch();
    s.cd[id] = it.cooldown;
    const boom = (t: ShipEnt, dmg: number, fire: boolean) => {
      this.emit({ k: 'hit', pid: 0, id: t.id, x: r1(t.k.x), y: 5, z: r1(t.k.z), dmg: Math.round(dmg * (1 - t.stats.armor)), by: s.id, fire, crit: true }, t.k.x, t.k.z);
      this.damage(t, dmg, dmg * 0.3, 'rond', s, fire);
    };
    switch (id) {
      case 'kit': s.repairing = 6; break;
      case 'seau': s.burning = 0; break;
      case 'poudre': s.powder = it.duration!; break;
      case 'reparation': s.hp = Math.min(s.stats.hp, s.hp + s.stats.hp * it.value! * s.stats.repair); break;
      case 'vitesse': s.fx.speed = it.duration!; break;
      case 'bouclier': s.fx.shield = it.duration!; break;
      case 'fumigene':
        s.fx.smoke = it.duration!;
        for (const o of this.ships.values()) if (o.ai && o.ai.target === s.id) { o.ai.target = 0; o.ai.mode = 'patrouille'; }
        this.emit({ k: 'boom', x: r1(s.k.x), z: r1(s.k.z) }, s.k.x, s.k.z);
        break;
      case 'harpon_bronze': case 'harpon_argent': case 'harpon_or': boom(target!, it.value! * s.stats.harpon, false); break;
      case 'feu_gregeois': boom(target!, it.value!, true); target!.burning = Math.max(target!.burning, it.duration!); break;
      case 'brulot':
        this.emit({ k: 'boom', x: r1(target!.k.x), z: r1(target!.k.z), big: true }, target!.k.x, target!.k.z);
        boom(target!, target!.stats.hp * it.value! * (target!.kind === 'boss' ? 0.2 : 1), true);
        target!.burning = Math.max(target!.burning, it.duration!);
        break;
      case 'corne':
        for (const o of this.ships.values()) {
          if (o === s || !this.canHarm(s, o) || dist2(s.k.x, s.k.z, o.k.x, o.k.z) > it.range! ** 2) continue;
          o.fx.slow = it.duration!;
        }
        link.notify('La Corne de Neptune résonne : les ennemis proches sont ralentis !', 'event');
        break;
      case 'lanterne': {
        const until = Date.now() + it.duration! * 1000;
        for (const l of this.links.values()) {
          const o = this.ships.get(l.entityId);
          const ally = l === link || (l.groupId && l.groupId === link.groupId);
          if (!ally || !o || dist2(s.k.x, s.k.z, o.k.x, o.k.z) > it.range! ** 2) continue;
          l.profile.buffs.lanterne = until;
          l.notify('Lanterne de Saint-Elme : +50 % d\'XP et de points élite pendant 10 minutes !', 'event');
          l.touch();
        }
        break;
      }
      case 'parchemin':
        p.buffs.xp2 = Date.now() + it.duration! * 1000;
        link.notify('Parchemin du Grand Navigateur : expérience doublée pendant 30 minutes !', 'event');
        break;
      case 'coffre_amiral': {
        const R = Math.random;
        const roll = R();
        const r = roll < 0.4 ? { or: 20000 + R() * 40000 } : roll < 0.65 ? { diamants: 2 + Math.floor(R() * 4) } : roll < 0.85 ? { equip: { c60: 2 + Math.floor(R() * 4) } } : roll < 0.97 ? { equip: { riga: 3 + Math.floor(R() * 5) } } : { diamants: 15 };
        grant(link, r, 'Coffre de l\'Amiral ouvert');
        break;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ boucle
  tick(dt: number) {
    if (this.links.size === 0) {
      this.emptyFor += dt;
      if (this.emptyFor > 30) return; // zone endormie : coûte zéro CPU
    } else this.emptyFor = 0;
    this.time += dt;
    this.updateWorld(dt);

    for (const link of this.links.values()) {
      if (link.deadTimer > 0) {
        link.deadTimer -= dt;
        if (link.deadTimer <= 0) this.respawn(link);
      }
      const s = this.ships.get(link.entityId);
      if (s && s.sinking < 0 && link.followLeader) this.followFleet(s, link);
      if (s && s.sinking < 0) this.pilot(s, link);
    }

    for (const s of [...this.ships.values()]) this.updateShip(s, dt);
    for (const f of this.forts.values()) this.updateFort(f, dt);
    this.updateProjectiles(dt);
    this.updateLoot();
  }

  private updateWorld(dt: number) {
    // Vent : dérive lente, rafales en tempête.
    if (Math.random() < dt / 40) this.windTarget = this.wind.dir + (Math.random() - 0.5) * 1.6;
    this.wind.dir += wrapAngle(this.windTarget - this.wind.dir) * dt * 0.05;
    const storm = this.weather.kind === 'tempete' ? this.weather.intensity : 0;
    this.wind.strength = 0.75 + 0.25 * storm + 0.05 * Math.sin(this.time * 0.3);
    // Météo : clair -> brume -> tempête selon le climat de la zone.
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      if (this.weather.intensity < 0.02) {
        const r = Math.random();
        this.nextWeather = r < this.def.storms * 0.5 ? 'tempete' : r < 0.25 + this.def.storms * 0.3 ? 'brume' : 'clair';
        this.weather.kind = this.nextWeather;
      } else this.nextWeather = 'clair';
      this.weatherTimer = 150 + Math.random() * 200;
    }
    const target = this.nextWeather === 'clair' || this.weather.kind === 'clair' ? 0 : 1;
    this.weather.intensity = clamp(this.weather.intensity + Math.sign(target - this.weather.intensity) * dt / 25, 0, 1);
    if (this.weather.intensity < 0.02 && target === 0) this.weather.kind = 'clair';
    const fogBoost = this.weather.kind === 'brume' ? 3 : this.weather.kind === 'tempete' ? 2 : 1;
    this.weather.fog = 1 + (fogBoost - 1) * this.weather.intensity;

    // Population de PNJ.
    let npcs = 0;
    for (const s of this.ships.values()) if (s.kind === 'npc') npcs++;
    const due = this.respawns.filter((t) => t <= this.time).length;
    if (due) this.respawns = this.respawns.filter((t) => t > this.time);
    for (let k = 0; k < due && npcs < this.def.npcCount; k++, npcs++) this.spawnNPC();
    // Boss de zone.
    if (this.def.boss) {
      if (this.bossId) {
        this.bossAge += dt;
        const b = this.ships.get(this.bossId);
        if (!b) this.bossId = 0;
        else if (this.bossAge > BOSS_LIFETIME && b.sinking < 0) {
          this.ships.delete(b.id);
          this.bossId = 0;
          for (const l of this.links.values()) { l.notify(`${b.name} disparaît dans la brume…`, 'event'); l.send({ t: 'boss', active: false }); }
        }
        this.bossTimer = BOSS_INTERVAL;
      } else if (this.def.bonus) {
        if (this.bonusKills >= this.def.bonus.bossAfter) this.spawnBoss();
      } else if (this.links.size > 0) {
        this.bossTimer -= dt;
        if (this.bossTimer <= 0) this.spawnBoss();
      }
    }
    // Coffres flottants.
    const dueChests = this.chestTimers.filter((t) => t <= this.time).length;
    if (dueChests) { this.chestTimers = this.chestTimers.filter((t) => t > this.time); for (let k = 0; k < dueChests; k++) this.spawnChest(); }
    // Trésors des épaves.
    for (const [wid, t] of this.wreckTimers) {
      if (t - dt <= 0) { this.wreckTimers.delete(wid); this.spawnTreasure(wid); }
      else this.wreckTimers.set(wid, t - dt);
    }
  }

  private updateShip(s: ShipEnt, dt: number) {
    if (s.sinking >= 0) {
      s.sinking += dt;
      s.k.speed *= 1 - dt * 0.5;
      s.k.x += Math.sin(s.k.h) * s.k.speed * dt;
      s.k.z += Math.cos(s.k.h) * s.k.speed * dt;
      if (s.sinking > SINK_TIME) this.ships.delete(s.id);
      return;
    }
    if (s.ai) thinkNPC(this, s, dt);
    const slow = s.sailHp / s.stats.sailHp;
    const speedMul = (1 + (s.fx.speed > 0 ? 0.5 : 0)) * (s.fx.slow > 0 ? 0.5 : 1);
    stepShip(s.k, s.stats, s.input, this.wind, dt, { sailRatio: slow, speedMul });
    const shock = collideShip(s.k, s.stats, this.world, this.def.half);
    if (shock > 6) this.damage(s, shock * s.stats.hp * 0.004 * dt * 20, 0, 'rond', null, false);

    s.reload[0] = Math.max(0, s.reload[0] - dt);
    s.reload[1] = Math.max(0, s.reload[1] - dt);
    for (const k of Object.keys(s.cd) as ConsumableId[]) s.cd[k] = Math.max(0, (s.cd[k] ?? 0) - dt);
    for (const k of ['speed', 'shield', 'slow', 'smoke', 'dmg', 'crit'] as const) s.fx[k] = Math.max(0, s.fx[k] - dt);
    for (const k of Object.keys(s.skillCd) as ActiveSkillId[]) s.skillCd[k] = Math.max(0, (s.skillCd[k] ?? 0) - dt);
    s.energy = Math.min(ENERGY_MAX, s.energy + ENERGY_REGEN * dt);
    if (s.shield < s.shieldMax && this.time - s.lastHit > SHIELD_DELAY) s.shield = Math.min(s.shieldMax, s.shield + s.shieldMax * SHIELD_REGEN * dt);
    s.powder = Math.max(0, s.powder - dt);
    if (s.burning > 0) {
      s.burning -= dt;
      this.damage(s, s.stats.hp * 0.011 * dt, s.stats.sailHp * 0.01 * dt, 'rond', null, false);
      if (s.sinking >= 0) return;
    }
    if (s.repairing > 0) {
      s.repairing -= dt;
      const k = (0.3 / 6) * dt * s.stats.repair;
      s.hp = Math.min(s.stats.hp, s.hp + s.stats.hp * k);
      s.sailHp = Math.min(s.stats.sailHp, s.sailHp + s.stats.sailHp * k);
    } else if (this.time - s.lastHit > 20) {
      const k = (s.kind === 'player' ? 0.004 : 0.01) * dt;
      s.hp = Math.min(s.stats.hp, s.hp + s.stats.hp * k);
      s.sailHp = Math.min(s.stats.sailHp, s.sailHp + s.stats.sailHp * k * 2);
    }
    if (s.link) this.playerChecks(s, s.link);
  }

  private playerChecks(s: ShipEnt, link: PlayerLink) {
    // Découverte d'îles.
    for (const isl of this.world.islands) {
      const key = `${this.def.id}:${isl.id}`;
      const r = isl.r + 260;
      if (dist2(s.k.x, s.k.z, isl.x, isl.z) > r * r) continue;
      if (link.profile.discovered.includes(key)) continue;
      link.profile.discovered.push(key);
      grant(link, { xp: 40 + this.def.levels[0] * 10, rep: 2 }, `Découverte : ${isl.name}`);
      progressMission(link, 'exploration', String(isl.id), 1);
    }
  }

  private updateFort(f: FortEnt, dt: number) {
    if (f.down > 0) {
      f.down -= dt;
      if (f.down <= 0) { f.hp = f.maxHp; f.dmgBy.clear(); }
      return;
    }
    f.reload -= dt;
    if (f.reload > 0) return;
    let best: ShipEnt | null = null, bd = f.range * f.range;
    for (const s of this.ships.values()) {
      if (!this.canHarm(f, s)) continue;
      const d = dist2(s.k.x, s.k.z, f.def.x, f.def.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) { f.reload = 1; return; }
    f.reload = 5;
    const d = Math.sqrt(bd);
    const v = Math.sqrt((f.range * 1.1 * GRAVITY) / 0.866);
    const flight = d / (v * 0.9);
    const tx = best.k.x + Math.sin(best.k.h) * best.k.speed * flight;
    const tz = best.k.z + Math.cos(best.k.h) * best.k.speed * flight;
    const yaw = Math.atan2(tx - f.def.x, tz - f.def.z);
    const dd = Math.hypot(tx - f.def.x, tz - f.def.z);
    const balls: Ball[] = [];
    const n = 4;
    const pid0 = nextId;
    nextId += n;
    const baseY = Math.max(6, terrainHeight(this.world, f.def.x, f.def.z) + 8);
    for (let j = 0; j < n; j++) {
      const el = elevationFor(dd * (1 + (Math.random() - 0.5) * 0.12), v);
      const yj = yaw + (Math.random() - 0.5) * 0.08;
      const hv = v * Math.cos(el);
      const ball: Ball = { x: f.def.x + Math.sin(yaw) * 15, y: baseY, z: f.def.z + Math.cos(yaw) * 15, vx: Math.sin(yj) * hv, vy: v * Math.sin(el), vz: Math.cos(yj) * hv, d: j * 0.18 };
      balls.push(ball);
      this.projectiles.push({ id: pid0 + j, owner: f.id, ...ball, delay: ball.d, dmg: f.dmg, ammo: 'rond', life: 9 });
    }
    this.emit({ k: 'shot', id: f.id, side: 'fort', pid: pid0, ammo: 'rond', t: this.time, balls: balls.map(round) }, f.def.x, f.def.z);
  }

  private updateProjectiles(dt: number) {
    const keep: Projectile[] = [];
    const SUB = 3;
    for (const p of this.projectiles) {
      if (p.delay > 0) {
        p.delay -= dt;
        if (p.delay > 0) { keep.push(p); continue; }
      }
      const owner: ShipEnt | FortEnt | undefined = this.ships.get(p.owner) ?? this.forts.get(p.owner);
      let done = false;
      const h = dt / SUB;
      for (let sub = 0; sub < SUB && !done; sub++) {
        p.x += p.vx * h;
        p.y += p.vy * h - 0.5 * GRAVITY * h * h;
        p.vy -= GRAVITY * h;
        p.z += p.vz * h;
        // Navires
        for (const s of this.ships.values()) {
          if (s.id === p.owner || s.sinking >= 0) continue;
          const reach = s.stats.length * 0.55;
          if (Math.abs(s.k.x - p.x) > reach || Math.abs(s.k.z - p.z) > reach) continue;
          if (p.y > 9 + SHIP_CLASSES[s.def.cls].gunDecks * 2.6 || p.y < -2.5) continue;
          const dx = p.x - s.k.x, dz = p.z - s.k.z;
          const along = dx * Math.sin(s.k.h) + dz * Math.cos(s.k.h);
          const lat = dx * Math.cos(s.k.h) - dz * Math.sin(s.k.h);
          const hl = s.stats.length * 0.5;
          if (Math.abs(along) > hl) continue;
          const t = along / hl;
          const halfBeam = s.stats.beam * 0.5 * (1 - 0.65 * t * t * (t > 0 ? 1 : 0.4));
          if (Math.abs(lat) > halfBeam + 0.8) continue;
          if (owner && !this.canHarm(owner, s)) continue; // les boulets traversent les alliés
          const ammo = AMMO[p.ammo];
          const crit = Math.random() < BASE_CRIT + (owner && 'fx' in owner && owner.fx.crit > 0 ? SKILL_CRIT_BONUS : 0);
          const hull = p.dmg * ammo.hull * (crit ? CRIT_MUL : 1);
          const fire = Math.random() < ammo.fire;
          this.emit({ k: 'hit', pid: p.id, id: s.id, x: r1(p.x), y: r1(p.y), z: r1(p.z), dmg: Math.round(hull * (1 - s.stats.armor)), by: p.owner, fire, crit }, p.x, p.z);
          this.damage(s, hull, p.dmg * ammo.sail * 0.8, p.ammo, owner ?? null, fire);
          if (ammo.crew) s.crewPenalty = Math.min(4, s.crewPenalty + ammo.crew / 4);
          done = true;
          break;
        }
        if (done) break;
        // Repaires pirates
        for (const f of this.forts.values()) {
          if (f.def.faction !== 'pirate' || f.down > 0) continue;
          if (dist2(p.x, p.z, f.def.x, f.def.z) > 26 * 26) continue;
          if (!owner || !this.canHarm(owner, f)) continue;
          this.emit({ k: 'hit', pid: p.id, id: f.id, x: r1(p.x), y: r1(p.y), z: r1(p.z), dmg: Math.round(p.dmg), by: p.owner }, p.x, p.z);
          this.damageFort(f, p.dmg, owner as ShipEnt);
          done = true;
          break;
        }
        if (done) break;
        if (p.y < 0) {
          this.emit({ k: 'splash', pid: p.id, x: r1(p.x), z: r1(p.z) }, p.x, p.z);
          done = true;
        } else if (p.y < 60 && terrainHeight(this.world, p.x, p.z) > p.y) {
          this.emit({ k: 'boom', x: r1(p.x), z: r1(p.z) }, p.x, p.z);
          done = true;
        }
      }
      p.life -= dt;
      if (!done && p.life > 0) keep.push(p);
    }
    this.projectiles = keep;
  }

  private updateLoot() {
    for (const l of [...this.loot.values()]) {
      if (this.time > l.expires) { this.loot.delete(l.id); continue; }
      for (const s of this.ships.values()) {
        if (s.kind !== 'player' || s.sinking >= 0) continue;
        const r = s.stats.length * 0.5 + 18;
        if (dist2(s.k.x, s.k.z, l.x, l.z) > r * r) continue;
        this.loot.delete(l.id);
        const link = s.link!;
        grant(link, { or: l.or, xp: l.xp, ferraille: l.ferraille, doublons: l.doublons, perles: l.perles, diamants: l.diamants, equip: l.equip, mat: l.mat }, l.kind === 'tresor' ? 'Trésor récupéré' : l.kind === 'coffre' ? 'Coffre ouvert' : 'Butin repêché');
        if (l.kind === 'coffre') this.chestTimers.push(this.time + 60 + Math.random() * 60);
        if (l.kind === 'tresor') {
          link.profile.stats.treasures++;
        }
        onLoot(link, l.kind);
        if (l.kind === 'tresor') {
          progressMission(link, 'tresor', String(l.wreck), 1);
          this.wreckTimers.set(l.wreck!, 240);
        }
        this.emit({ k: 'loot', id: l.id, by: s.id }, l.x, l.z);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ dégâts
  damage(s: ShipEnt, hull: number, sail: number, ammo: AmmoId, attacker: ShipEnt | FortEnt | null, fire: boolean) {
    if (s.sinking >= 0) return;
    const real = hull * (1 - s.stats.armor) * (s.fx.shield > 0 ? 0.6 : 1);
    // Le bouclier encaisse d'abord ; seul le reste entame la coque.
    const absorbed = Math.min(s.shield, real);
    s.shield -= absorbed;
    s.hp -= real - absorbed;
    s.sailHp = Math.max(0, s.sailHp - sail);
    if (attacker) {
      s.lastHit = this.time;
      s.dmgBy.set(attacker.id, (s.dmgBy.get(attacker.id) ?? 0) + real);
      if ('k' in attacker && attacker.link) {
        attacker.link.profile.stats.damage += real;
        onDamage(attacker.link, real, ammo, s.kind === 'player');
        if (s.kind === 'boss') progressMission(attacker.link, 'boss', 'spectre', real);
        if (s.kind === 'boss' && this.def.bonus) {
          // Cartes bonus : gains par tranche de 10 000 dégâts infligés au boss.
          const id = attacker.id;
          let acc = (this.bonusDmg.get(id) ?? 0) + real;
          while (acc >= 10000) {
            acc -= 10000;
            attacker.link.profile.elite += this.def.bonus.per10k.elite;
            grant(attacker.link, { xp: this.def.bonus.per10k.xp }, `${s.name} : 10 000 dégâts (+${this.def.bonus.per10k.elite} points élite)`);
          }
          this.bonusDmg.set(id, acc);
        }
      }
      if (s.ai && 'k' in attacker && s.ai.mode === 'patrouille') { s.ai.target = attacker.id; s.ai.mode = 'combat'; }
    }
    if (fire && s.burning <= 0) s.burning = 10;
    if (s.kind === 'boss') {
      for (const l of this.links.values()) if (Math.random() < 0.15) l.send({ t: 'boss', active: true, hp: Math.max(0, Math.round(s.hp)), maxHp: s.stats.hp, name: s.name });
    }
    if (s.hp <= 0) this.sink(s, attacker);
  }

  private damageFort(f: FortEnt, dmg: number, by: ShipEnt) {
    f.hp -= dmg;
    f.dmgBy.set(by.id, (f.dmgBy.get(by.id) ?? 0) + dmg);
    if (f.hp > 0) return;
    f.down = 300;
    this.emit({ k: 'boom', x: f.def.x, z: f.def.z, big: true }, f.def.x, f.def.z);
    const total = [...f.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    for (const [id, d] of f.dmgBy) {
      const link = this.links.get(id);
      if (!link) continue;
      const share = 0.3 + 0.7 * (d / total);
      grant(link, { or: 1500 * (1 + f.level * 0.2) * share, xp: 500 * (1 + f.level * 0.15) * share, rep: 15, doublons: 6 }, `${f.def.name} détruite`);
    }
    // Toutes les tours de l'île sont tombées : l'île est conquise.
    const towers = [...this.forts.values()].filter((o) => o.def.islandId === f.def.islandId && o.def.faction === 'pirate');
    if (towers.every((o) => o.down > 0)) {
      const isl = this.world.islands.find((i) => i.id === f.def.islandId);
      const all = new Map<number, number>();
      for (const o of towers) for (const [id, d] of o.dmgBy) all.set(id, (all.get(id) ?? 0) + d);
      for (const [id] of all) {
        const link = this.links.get(id);
        if (link) grant(link, { or: 6000 * (1 + f.level * 0.25), xp: 2500 * (1 + f.level * 0.15), rep: 60, perles: 3 + this.def.tier, diamants: this.def.tier >= 4 ? 1 : 0, equip: this.equipDrop(4) }, `Île fortifiée ${isl?.name ?? ''} conquise !`);
      }
      for (const l of this.links.values()) l.notify(`L'île fortifiée ${isl?.name ?? ''} est tombée !`, 'event');
      for (const o of towers) o.down = 420; // reconstruction après 7 minutes
    }
  }

  private sink(s: ShipEnt, attacker: ShipEnt | FortEnt | null) {
    s.hp = 0;
    s.sinking = 0;
    s.burning = 5;
    this.emit({ k: 'sink', id: s.id, by: attacker?.id }, s.k.x, s.k.z);
    this.emit({ k: 'boom', x: r1(s.k.x), z: r1(s.k.z), big: true }, s.k.x, s.k.z);
    const total = [...s.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    const killer = attacker && 'k' in attacker ? attacker : null;

    if (s.kind === 'player') {
      const link = s.link!;
      link.profile.stats.deaths++;
      link.profile.cargo = {};
      link.deadTimer = SINK_TIME * 0.6 + RESPAWN_TIME;
      link.notify(killer ? `Votre navire a été coulé par ${killer.name}. Vous serez remorqué jusqu'au port.` : 'Votre navire a sombré. Vous serez remorqué jusqu\'au port.', 'warn');
      link.touch();
      // Prime de l'Amirauté pour les victoires entre joueurs (rien n'est pris à la victime).
      for (const [id, d] of s.dmgBy) {
        const l2 = this.links.get(id);
        if (!l2 || l2 === link) continue;
        const war = this.hooks.relation(l2, link) === 'war' ? 2 : 1;
        const share = 0.3 + 0.7 * (d / total);
        if (killer && killer.id === id) { l2.profile.stats.pvp++; onPlayerKill(l2); this.hooks.onPvpKill?.(this, l2, link); }
        grant(l2, { or: 400 * s.level * share * war, xp: 120 * s.level * share * war, rep: Math.round(15 * war) }, `Victoire sur ${s.name}`);
      }
      return;
    }

    // PNJ ou boss : récompenses partagées selon les dégâts infligés.
    const lvlF = 1 + s.level * 0.06;
    const base = s.kind === 'boss'
      ? { or: 25000 * (1 + s.level * 0.08), xp: 9000 * (1 + s.level * 0.05), rep: 150, doublons: 60, perles: 12 }
      : { or: 130 * Math.pow(s.tier, 1.9) * lvlF, xp: 65 * Math.pow(s.tier, 1.8) * (1 + s.level * 0.08), rep: 3 * s.tier, doublons: 0, perles: 0 };
    for (const [id, d] of s.dmgBy) {
      const link = this.links.get(id);
      if (!link) continue;
      const share = Math.min(1, 0.3 + 0.7 * (d / total));
      const mul = this.def.rewardMul;
      const r = { or: base.or * share * mul, xp: base.xp * share * mul, rep: base.rep * share, doublons: base.doublons * share, perles: base.perles * share };
      grant(link, r, s.kind === 'boss' ? `${s.name} est vaincu !` : `${s.name} coulé`);
      if (killer?.id === id || d / total > 0.3) {
        link.profile.stats.kills++;
        if (s.kind === 'boss') link.profile.stats.boss++;
        progressMission(link, 'chasse', s.faction, 1);
        this.hooks.onKill?.(this, link);
        onNpcKill(link, s);
      }
    }
    if (s.kind === 'boss') {
      let best: PlayerLink | null = null, bd = 0;
      for (const [id, d] of s.dmgBy) { const l = this.links.get(id); if (l && d > bd) { bd = d; best = l; } }
      if (best) this.hooks.onConquest?.(this, best);
      this.bossId = 0;
      for (const l of this.links.values()) { l.send({ t: 'boss', active: false }); l.notify(`${s.name} sombre dans les abysses ! La brume se dissipe.`, 'event'); }
      this.hooks.broadcastChat?.(`${s.name} a été vaincu dans ${this.def.name} !`);
    }
    if (s.kind === 'npc') {
      this.respawns.push(this.time + (this.def.bonus ? 60 : Zone.NPC_RESPAWN));
      if (this.def.bonus) this.bonusKills++;
    }
    // Épave flottante à repêcher.
    const id = allocId();
    const R = Math.random;
    this.loot.set(id, {
      id, x: s.k.x + (R() - 0.5) * 20, z: s.k.z + (R() - 0.5) * 20, kind: 'caisse',
      or: Math.round(base.or * 0.25 * (0.6 + R() * 0.8)), doublons: R() < 0.12 ? 1 + Math.floor(R() * 3) : 0, perles: R() < 0.06 + 0.02 * this.def.tier ? 1 + Math.floor(R() * this.def.tier / 3) : 0,
      diamants: s.kind === 'boss' ? 3 + this.def.tier : R() < 0.01 * this.def.tier ? 1 : 0,
      equip: this.equipDrop(s.kind === 'boss' ? 6 : 1),
      ferraille: Math.round((3 + R() * 8) * s.tier * (s.kind === 'boss' ? 5 : 1)),
      mat: { bois: Math.floor(R() * 3 * s.tier), toile: Math.floor(R() * 3 * s.tier), fer: Math.floor(R() * 2 * s.tier) },
      expires: this.time + 90,
    });
  }

  private respawn(link: PlayerLink) {
    link.deadTimer = 0;
    const s = this.ships.get(link.entityId);
    const port = s ? this.nearestPort(s.k.x, s.k.z) : this.def.ports.find((p) => p.id === link.port) ?? this.def.ports[0];
    // Le navire est renfloué en mer, devant le port le plus proche, coque et voiles réparées.
    this.ships.delete(link.entityId);
    link.docked = true;
    link.port = port.id;
    link.profile.port = port.id;
    link.hpRatio = 1;
    link.sailRatio = 1;
    link.targetId = 0;
    link.attacking = false;
    this.undock(link);
    link.notify(`Votre navire a été renfloué devant ${port.name}.`, 'info');
    link.touch();
  }

  // ------------------------------------------------------------------ réseau
  private emit(ev: GameEvent, x: number, z: number) {
    this.events.push({ ev, x, z });
  }

  /** Construit et envoie à chaque joueur ce qu'il doit voir (gestion d'intérêt par distance). */
  broadcast(dayFraction: number) {
    if (this.links.size === 0) { this.events.length = 0; return; }
    const R2 = VIEW_RADIUS * VIEW_RADIUS;
    for (const link of this.links.values()) {
      const me = this.ships.get(link.entityId);
      const port = this.def.ports.find((p) => p.id === link.port) ?? this.def.ports[0];
      const cx = me ? me.k.x : this.world.docks[port.id].x;
      const cz = me ? me.k.z : this.world.docks[port.id].z;
      const ents: EntityState[] = [];
      const metas: EntityMeta[] = [];
      for (const s of this.ships.values()) {
        if (s.id !== link.entityId && dist2(s.k.x, s.k.z, cx, cz) > R2 && s.kind !== 'boss') continue;
        let flags = 0;
        if (s.burning > 0) flags |= F_BURNING;
        if (s.sinking >= 0) flags |= F_SINKING;
        if (s.repairing > 0) flags |= F_REPAIRING;
        if (s.link?.pvp) flags |= F_PVP;
        if (this.inSafeZone(s.k.x, s.k.z)) flags |= F_SAFE;
        ents.push([s.id, r1(s.k.x), r1(s.k.z), Math.round(s.k.h * 1000) / 1000, r1(s.k.speed), Math.round((s.hp / s.stats.hp) * 1000), flags, s.input.sail, Math.round((s.sailHp / s.stats.sailHp) * 1000)]);
        if (!link.known.has(s.id)) {
          link.known.add(s.id);
          const friend = s.link && s.id !== link.entityId ? this.hooks.relation(link, s.link) === 'friend' : false;
          metas.push({ id: s.id, kind: s.kind, ship: s.def.id, name: s.name, level: s.level, faction: s.faction, tag: s.link?.guildTag ?? null, maxHp: s.stats.hp, flag: s.link?.profile.flag, friend, skin: s.link?.profile.skin ?? null, shootRank: s.link ? stepOf(battlePoints(s.link.profile.shootXp), battleThreshold, BATTLE_STEPS) : undefined, grade: s.link?.grade });
        }
      }
      for (const f of this.forts.values()) {
        if (dist2(f.def.x, f.def.z, cx, cz) > R2) continue;
        ents.push([f.id, r1(f.def.x), r1(f.def.z), f.def.facing, 0, f.down > 0 ? 0 : Math.round((f.hp / f.maxHp) * 1000), 0, 0, 0]);
        if (!link.known.has(f.id)) {
          link.known.add(f.id);
          metas.push({ id: f.id, kind: 'fort', name: f.def.name, level: f.level, faction: f.def.faction, maxHp: f.def.faction === 'france' ? 0 : Math.round(f.maxHp) });
        }
      }
      for (const l of this.loot.values()) {
        if (dist2(l.x, l.z, cx, cz) > R2) continue;
        ents.push([l.id, r1(l.x), r1(l.z), 0, 0, 1000, 0, 0, 0]);
        if (!link.known.has(l.id)) {
          link.known.add(l.id);
          metas.push({ id: l.id, kind: 'loot', name: l.kind === 'tresor' ? 'Coffre au trésor' : l.kind === 'coffre' ? 'Coffre' : 'Butin flottant', level: 0, faction: 'france', maxHp: 0, loot: l.kind });
        }
      }
      if (metas.length) link.send({ t: 'meta', list: metas });
      const ev: GameEvent[] = [];
      const ER = (VIEW_RADIUS + 300) ** 2;
      for (const e of this.events) if (dist2(e.x, e.z, cx, cz) < ER) ev.push(e.ev);
      const meState: MeState = {
        id: link.entityId,
        docked: link.docked,
        reload: me ? [r1(me.reload[0]), r1(me.reload[1])] : [0, 0],
        reloadMax: me ? r1(me.stats.reload) : 1,
        ammo: me ? me.ammo : 'rond',
        cd: me ? Object.fromEntries(Object.entries(me.cd).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => [k, r1(v!)])) : {},
        seq: link.seq,
        dead: link.deadTimer > 0 ? r1(link.deadTimer) : 0,
        powder: me ? r1(me.powder) : 0,
        pvp: link.pvp,
        safe: me ? this.inSafeZone(me.k.x, me.k.z) : true,
        helm: me ? [me.input.sail, Math.round(me.input.rudder * 100) / 100] : [0, 0],
        auto: !!link.nav || link.attacking,
        nav: link.nav ? [Math.round(link.nav.x), Math.round(link.nav.z)] : null,
        target: link.targetId,
        attacking: link.attacking,
        fishing: link.fishing,
        shield: me ? Math.round(me.shield) : 0,
        shieldMax: me ? Math.round(me.shieldMax) : 0,
        energy: me ? Math.floor(me.energy) : 0,
        skillCd: me ? Object.fromEntries(Object.entries(me.skillCd).filter(([, v]) => (v ?? 0) > 0).map(([k, v]) => [k, r1(v!)])) : {},
        boost: me ? { dmg: r1(me.fx.dmg), crit: r1(me.fx.crit), speed: r1(me.fx.speed), shield: r1(me.fx.shield) } : { dmg: 0, crit: 0, speed: 0, shield: 0 },
        fleet: me ? this.fleetAllies(me) : 0,
        raid: this.raidActive,
      };
      link.send({ t: 'snap', st: Math.round(this.time * 1000) / 1000, wind: { dir: Math.round(this.wind.dir * 1000) / 1000, strength: Math.round(this.wind.strength * 100) / 100 }, wx: { ...this.weather, intensity: Math.round(this.weather.intensity * 100) / 100, fog: Math.round(this.weather.fog * 100) / 100 }, day: Math.round(dayFraction * 10000) / 10000, me: meState, e: ents, ev });
    }
    this.events.length = 0;
  }
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const round = (b: Ball): Ball => ({ x: r1(b.x), y: r1(b.y), z: r1(b.z), vx: Math.round(b.vx * 100) / 100, vy: Math.round(b.vy * 100) / 100, vz: Math.round(b.vz * 100) / 100, d: Math.round(b.d * 1000) / 1000 });
