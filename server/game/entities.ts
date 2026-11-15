import type { AmmoId, ConsumableId } from '../../shared/items.ts';
import type { ActiveSkillId } from '../../shared/combat.ts';
import type { EquipId } from '../../shared/equipment.ts';
import type { HelmInput, ShipKinematics } from '../../shared/physics.ts';
import type { ShipDef, ShipStats } from '../../shared/ships.ts';
import type { FortDef } from '../../shared/world.ts';
import type { Faction } from '../../shared/zones.ts';
import type { PlayerLink } from '../types.ts';

export interface AIState {
  mode: 'patrouille' | 'combat' | 'fuite' | 'retour';
  target: number;
  wx: number;
  wz: number;
  think: number;
  homeX: number;
  homeZ: number;
  aggro: number;
  accuracy: number;
  side: 1 | -1;
}

export interface ShipEnt {
  id: number;
  kind: 'player' | 'npc' | 'boss';
  def: ShipDef;
  stats: ShipStats;
  level: number;
  faction: Faction;
  name: string;
  k: ShipKinematics;
  input: HelmInput;
  hp: number;
  sailHp: number;
  reload: [number, number];
  ammo: AmmoId;
  burning: number;
  repairing: number;
  powder: number;
  crewPenalty: number;
  cd: Partial<Record<ConsumableId, number>>;
  /** Effets temporaires (secondes restantes). */
  fx: { speed: number; shield: number; slow: number; smoke: number; dmg: number; crit: number };
  /** Bouclier (absorbe les dégâts avant la coque), énergie et recharges des compétences actives. */
  shield: number;
  shieldMax: number;
  energy: number;
  skillCd: Partial<Record<ActiveSkillId, number>>;
  sinking: number; // < 0 : à flot ; >= 0 : secondes écoulées depuis le naufrage
  dmgBy: Map<number, number>;
  lastHit: number;
  link?: PlayerLink;
  ai?: AIState;
  tier: number;
  dmgMul: number;
}

export interface FortEnt {
  id: number;
  def: FortDef;
  hp: number;
  maxHp: number;
  reload: number;
  range: number;
  dmg: number;
  level: number;
  down: number; // secondes avant reconstruction (0 = actif)
  dmgBy: Map<number, number>;
}

export interface LootEnt {
  id: number;
  x: number;
  z: number;
  kind: 'caisse' | 'tresor' | 'coffre';
  xp?: number;
  ferraille?: number;
  or: number;
  doublons: number;
  perles: number;
  diamants: number;
  equip: Partial<Record<EquipId, number>>;
  mat: { bois: number; toile: number; fer: number };
  expires: number;
  wreck?: number;
}

export interface Projectile {
  id: number;
  owner: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  dmg: number;
  ammo: AmmoId;
  delay: number;
  life: number;
}
