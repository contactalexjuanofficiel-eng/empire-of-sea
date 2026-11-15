// État de l'interface (React) : un petit magasin observable, mis à jour par le moteur de jeu et le réseau.
import { useSyncExternalStore } from 'react';
import type { AmmoId, ConsumableId, GoodId } from '../../shared/items';
import type { ChatChannel, GuildInfo, MapInfo, MissionOffer, Profile } from '../../shared/protocol';
import { defaultKeys } from './game/Input';

export interface HudState {
  hp: number; maxHp: number; sailHp: number;
  speed: number; sail: number; heading: number;
  windDir: number; windStr: number;
  reload: [number, number]; reloadMax: number;
  ammo: AmmoId; cd: Partial<Record<ConsumableId, number>>;
  dead: number; pvp: boolean; safe: boolean; powder: number;
  burning: boolean; repairing: boolean;
  canDock: string | null;
  aim: 'babord' | 'tribord' | null;
  x: number; z: number;
  weather: string; day: number;
  fishing: boolean;
}
export interface NearbyShip { id: number; name: string; kind: string; level: number; dist: number; hp: number; hostile: boolean; friend: boolean; tag?: string | null; ship?: string; faction: string }
export interface ChatLine { id: number; ch: ChatChannel; from: string; text: string; tag?: string | null }
export interface Notice { id: number; text: string; kind: string; t: number }
export type Panel = null | 'port' | 'inventaire' | 'profil' | 'classement' | 'guilde' | 'carte' | 'aide' | 'parametres' | 'missions' | 'boutique' | 'capitaines' | 'bonus' | 'rangs';
export interface TargetInfo { id: number; name: string; kind: string; level: number; hp: number; dist: number; hostile: boolean; faction: string; ship?: string }
export interface Settings { quality: 'haute' | 'moyenne' | 'basse'; volume: number; muted: boolean; autoCam: boolean; labels: boolean; camMode: 'dessus' | '3d'; autoAttack: boolean; keys: Record<string, string> }

export interface AppState {
  screen: 'login' | 'create' | 'loading' | 'game';
  connection: 'off' | 'connecting' | 'on' | 'lost';
  name: string;
  profile: Profile | null;
  zone: string;
  port: string | null;
  docked: boolean;
  hud: HudState;
  nearby: NearbyShip[];
  chat: ChatLine[];
  notices: Notice[];
  portData: { offers: MissionOffer[]; prices: Partial<Record<GoodId, { buy: number; sell: number }>> } | null;
  guild: GuildInfo | null;
  group: { members: string[]; leader: string | null; invite?: string };
  boss: { active: boolean; hp?: number; maxHp?: number; name?: string; x?: number; z?: number };
  panel: Panel;
  portTab: string;
  error: string | null;
  ping: number;
  preview: string;
  settings: Settings;
  chatFocus: number;
  fps: number;
  maps: MapInfo[];
  grade: { grade: number; points: number; next: number | null; prev: number | null; counts: number[]; position: number } | null;
  target: TargetInfo | null;
  attacking: boolean;
}

const loadSettings = (): Settings => {
  const d: Settings = { quality: 'moyenne', volume: 0.7, muted: false, autoCam: true, labels: true, camMode: 'dessus', autoAttack: true, keys: defaultKeys() };
  try {
    const s = { ...d, ...JSON.parse(localStorage.getItem('edm.settings') || '{}') } as Settings;
    s.keys = { ...defaultKeys(), ...(s.keys || {}) };
    if (s.keys.camCenter === 'Digit9') s.keys.camCenter = 'KeyX'; // ancienne touche, reprise par la barre rapide
    return s;
  } catch { return d; }
};

const initial: AppState = {
  screen: 'login',
  connection: 'off',
  name: '',
  profile: null,
  zone: 'manche',
  port: null,
  docked: true,
  hud: { hp: 1, maxHp: 1, sailHp: 1, speed: 0, sail: 0, heading: 0, windDir: 0, windStr: 1, reload: [0, 0], reloadMax: 5, ammo: 'rond', cd: {}, dead: 0, pvp: false, safe: true, powder: 0, burning: false, repairing: false, canDock: null, aim: null, x: 0, z: 0, weather: 'clair', day: 0.5, fishing: false },
  nearby: [],
  chat: [],
  notices: [],
  portData: null,
  guild: null,
  group: { members: [], leader: null },
  boss: { active: false },
  panel: null,
  portTab: 'chantier',
  error: null,
  ping: 0,
  preview: 'bayonnaise',
  settings: loadSettings(),
  chatFocus: 0,
  fps: 0,
  maps: [],
  grade: null,
  target: null,
  attacking: false,
};

type Listener = () => void;
let state = initial;
const listeners = new Set<Listener>();

export const store = {
  get: () => state,
  set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...p };
    for (const l of listeners) l();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useStore<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state));
}

let nid = 1;
export function notify(text: string, kind = 'info') {
  const n = { id: nid++, text, kind, t: performance.now() };
  store.set((s) => ({ notices: [...s.notices.slice(-5), n] }));
  setTimeout(() => store.set((s) => ({ notices: s.notices.filter((x) => x.id !== n.id) })), kind === 'level' || kind === 'event' ? 7000 : 4500);
}
export function pushChat(line: Omit<ChatLine, 'id'>) {
  store.set((s) => ({ chat: [...s.chat.slice(-80), { ...line, id: nid++ }] }));
}
export function saveSettings(s: Settings) {
  store.set({ settings: s });
  try { localStorage.setItem('edm.settings', JSON.stringify(s)); } catch { /* stockage indisponible */ }
}
