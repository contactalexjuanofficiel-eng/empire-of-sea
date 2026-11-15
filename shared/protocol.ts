// Protocole réseau client <-> serveur (JSON sur WebSocket).
// Règle d'or : le client n'envoie que des INTENTIONS ; le serveur décide de tout (positions, dégâts, or, XP).
import type { AmmoId, ConsumableId, GoodId, MaterialId, SkillId, UpgradeSlot } from './items.ts';
import type { ShipUpgrades, Skills } from './ships.ts';
import type { EquipId, Fit } from './equipment.ts';
import type { CaptainCat, DailyKind, FishId, SkinId } from './extras.ts';
import type { Faction } from './zones.ts';

export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 20; // simulations par seconde
export const VIEW_RADIUS = 1900; // rayon d'intérêt : on ne reçoit que ce qui est proche

export type FlagChoice = 'royal' | 'tricolore' | 'imperial';
export type Side = 'babord' | 'tribord';

export interface OwnedShip { uid: string; def: string; up: ShipUpgrades; name?: string; fit?: Fit }

export type MissionType = 'chasse' | 'livraison' | 'exploration' | 'tresor' | 'boss';
export interface MissionOffer {
  id: string;
  type: MissionType;
  title: string;
  desc: string;
  goal: number;
  target?: string; // faction, port, île, épave…
  zone: string;
  reward: { or: number; xp: number; rep: number; doublons?: number; mat?: Partial<Record<MaterialId, number>> };
  cargo?: { good: GoodId; qty: number };
}
export interface ActiveMission extends MissionOffer { progress: number }

export interface Profile {
  name: string;
  created: boolean;
  portrait: number;
  flag: FlagChoice;
  xp: number;
  reputation: number;
  or: number;
  doublons: number;
  perles: number;
  diamants: number;
  /** Équipement en stock (non installé). */
  equip: Partial<Record<EquipId, number>>;
  mat: Record<MaterialId, number>;
  ships: OwnedShip[];
  active: string; // uid du navire actif
  ammo: Record<AmmoId, number>;
  items: Partial<Record<ConsumableId, number>>;
  /** Effets temporaires (horodatages de fin, en ms). */
  buffs: { xp2?: number; lanterne?: number };
  cargo: Partial<Record<GoodId, number>>;
  skills: Skills;
  zone: string;
  port: string;
  missions: ActiveMission[];
  discovered: string[];
  stats: { kills: number; pvp: number; deaths: number; damage: number; treasures: number; trades: number; boss: number; profit: number };
  guild: string | null;
  /** Étage de cartes débloqué (1 = Manche) et navires coulés à cet étage pour la mission de passage. */
  tier: number;
  tierKills: number;
  /** Grades : points de tir et de pêche. */
  shootXp: number;
  fishXp: number;
  fish: Partial<Record<FishId, number>>;
  /** Points élite (cumulés, jamais dépensés) et ferraille pour la forge. */
  elite: number;
  ferraille: number;
  /** Ponts forgés par le matelot de pont (8 emplacements). */
  forge: boolean[];
  skins: SkinId[];
  skin: SkinId | null;
  captains: string[];
  captainsActive: Partial<Record<CaptainCat, string | null>>;
  daily: { active: { id: DailyKind; progress: number; goal: number; tier: number }[]; cooldown: Partial<Record<DailyKind, number>> };
  levelMission: { level: number; progress: number };
}

// --- Messages client -> serveur --------------------------------------------
export type ShopAction =
  | { a: 'buyShip'; ship: string }
  | { a: 'selectShip'; uid: string }
  | { a: 'upgrade'; slot: UpgradeSlot }
  | { a: 'buyAmmo'; ammo: AmmoId }
  | { a: 'buyItem'; item: ConsumableId; qty: number }
  | { a: 'repair' }
  | { a: 'trade'; good: GoodId; qty: number; buy: boolean }
  | { a: 'skill'; skill: SkillId }
  | { a: 'exchange'; what: 'doublons' | 'perles' }
  | { a: 'buyEquip'; item: EquipId; qty: number }
  | { a: 'install'; item: EquipId; qty: number }
  | { a: 'uninstall'; item: EquipId; qty: number }
  | { a: 'sellFish' }
  | { a: 'buySkin'; skin: SkinId }
  | { a: 'useSkin'; skin: SkinId | null }
  | { a: 'forge'; slot: number }
  | { a: 'recruit'; captain: string }
  | { a: 'assign'; captain: string | null; cat: CaptainCat }
  | { a: 'eliteShip'; ship: string };

export type C2S =
  | { t: 'hello'; token: string; v: number }
  | { t: 'create'; portrait: number; flag: FlagChoice; ship: string }
  | { t: 'input'; sail: number; rudder: number; seq: number }
  | { t: 'move'; x: number; z: number }
  | { t: 'target'; id: number; attack: boolean }
  | { t: 'fire'; side: Side | 'both'; x: number; z: number }
  | { t: 'ammo'; id: AmmoId }
  | { t: 'use'; id: ConsumableId }
  | { t: 'dock' }
  | { t: 'undock' }
  | ({ t: 'shop' } & ShopAction)
  | { t: 'mission'; a: 'accept' | 'abandon'; id: string }
  | { t: 'travel'; zone: string }
  | { t: 'chat'; ch: ChatChannel; text: string; to?: string }
  | { t: 'guild'; a: 'create' | 'invite' | 'accept' | 'leave' | 'kick' | 'ally' | 'war' | 'peace' | 'info'; name?: string; tag?: string }
  | { t: 'group'; a: 'invite' | 'accept' | 'leave'; name?: string }
  | { t: 'pvp'; on: boolean }
  | { t: 'fish'; on: boolean }
  | { t: 'daily'; a: 'start' | 'abandon'; id: DailyKind }
  | { t: 'ping'; c: number };

export type ChatChannel = 'zone' | 'monde' | 'guilde' | 'groupe' | 'prive' | 'systeme';

// --- Messages serveur -> client --------------------------------------------
export type EntityKind = 'player' | 'npc' | 'boss' | 'fort' | 'loot';

export const F_BURNING = 1, F_SINKING = 2, F_REPAIRING = 4, F_PVP = 8, F_SAFE = 16;

/** État compact d'une entité : [id, x, z, cap, vitesse, pv‰, drapeaux, voiles, voilure‰] */
export type EntityState = [number, number, number, number, number, number, number, number, number];

export interface EntityMeta {
  id: number;
  kind: EntityKind;
  ship?: string;
  name: string;
  level: number;
  faction: Faction;
  tag?: string | null;
  maxHp: number;
  flag?: FlagChoice;
  friend?: boolean; // même groupe / guilde / alliance
  hostile?: boolean;
  loot?: 'caisse' | 'tresor' | 'coffre';
  skin?: SkinId | null;
  shootRank?: number;
}

export interface Ball { x: number; y: number; z: number; vx: number; vy: number; vz: number; d: number }

export type GameEvent =
  | { k: 'shot'; id: number; side: Side | 'fort'; pid: number; ammo: AmmoId; t: number; balls: Ball[] }
  | { k: 'hit'; pid: number; id: number; x: number; y: number; z: number; dmg: number; by: number; fire?: boolean; crit?: boolean }
  | { k: 'splash'; pid: number; x: number; z: number }
  | { k: 'sink'; id: number; by?: number }
  | { k: 'boom'; x: number; z: number; big?: boolean }
  | { k: 'loot'; id: number; by: number };

export interface MeState {
  id: number;
  docked: boolean;
  reload: [number, number]; // secondes restantes bâbord / tribord
  reloadMax: number;
  ammo: AmmoId;
  cd: Partial<Record<ConsumableId, number>>;
  seq: number;
  dead: number; // secondes avant réapparition (0 = vivant)
  powder: number;
  pvp: boolean;
  safe: boolean;
  /** Barre et voilure réellement appliquées (pilote automatique compris). */
  helm: [number, number];
  auto: boolean;
  nav: [number, number] | null;
  target: number;
  attacking: boolean;
  fishing: boolean;
}

export interface WeatherState { kind: 'clair' | 'brume' | 'tempete'; intensity: number; fog: number }

export type S2C =
  | { t: 'welcome'; id: number; name: string; profile: Profile; zone: string; port: string | null; st: number }
  | { t: 'need_create'; name: string }
  | { t: 'profile'; p: Profile }
  | { t: 'zone'; zone: string; port: string | null; id: number }
  | { t: 'snap'; st: number; wind: { dir: number; strength: number }; wx: WeatherState; day: number; me: MeState; e: EntityState[]; ev: GameEvent[] }
  | { t: 'meta'; list: EntityMeta[] }
  | { t: 'chat'; ch: ChatChannel; from: string; text: string; tag?: string | null }
  | { t: 'notice'; text: string; kind?: 'info' | 'gain' | 'warn' | 'level' | 'event' }
  | { t: 'port'; port: string; offers: MissionOffer[]; prices: Partial<Record<GoodId, { buy: number; sell: number }>> }
  | { t: 'guild'; info: GuildInfo | null }
  | { t: 'group'; members: string[]; leader: string | null; invite?: string }
  | { t: 'boss'; active: boolean; hp?: number; maxHp?: number; name?: string; x?: number; z?: number }
  | { t: 'pong'; c: number; st: number }
  | { t: 'maps'; list: MapInfo[] }
  | { t: 'err'; text: string };

export interface MapInfo { id: string; players: number; owner: string | null; kills?: number; bossAt?: number; boss?: boolean; open?: boolean }

export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  leader: string;
  members: { name: string; online: boolean; level: number }[];
  allies: string[];
  wars: string[];
  invites?: string[];
}

export interface LeaderEntry { name: string; level: number; xp: number; kills: number; pvp: number; reputation: number; tag: string | null; ship: string }
