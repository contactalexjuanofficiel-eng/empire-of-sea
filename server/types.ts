import type { HelmInput } from '../shared/physics.ts';
import type { Profile, S2C } from '../shared/protocol.ts';

/** Un joueur connecté, tel que le voient les zones. */
export interface PlayerLink {
  accountId: number;
  name: string;
  profile: Profile;
  send(msg: S2C): void;
  notify(text: string, kind?: 'info' | 'gain' | 'warn' | 'level' | 'event'): void;
  /** Marque le profil comme modifié : il sera renvoyé au client et sauvegardé. */
  touch(): void;
  zoneId: string;
  entityId: number;
  docked: boolean;
  port: string | null;
  input: HelmInput;
  seq: number;
  pvp: boolean;
  /** Santé conservée entre deux sorties en mer (ratio 0..1). */
  hpRatio: number;
  sailRatio: number;
  /** Entités dont la fiche (nom, navire…) a déjà été envoyée. */
  known: Set<number>;
  deadTimer: number;
  groupId: string | null;
  guildTag: string | null;
  /** Destination cliquée sur la mer (pilote automatique), cible sélectionnée, attaque en cours. */
  nav: { x: number; z: number } | null;
  targetId: number;
  attacking: boolean;
}

export type Relation = 'friend' | 'neutral' | 'war';
