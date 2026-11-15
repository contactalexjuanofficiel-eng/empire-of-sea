// Entrées clavier et souris. Les touches sont configurables (Paramètres) ; on enregistre le code physique
// de la touche (e.code), donc les raccourcis restent à la même place sur AZERTY et QWERTY.
export type Action =
  | 'attack' | 'cancelAttack' | 'fireBoth'
  | 'sailUp' | 'sailDown' | 'left' | 'right'
  | 'hot1' | 'hot2' | 'hot3' | 'hot4' | 'hot5' | 'hot6' | 'hot7' | 'hot8' | 'hot9' | 'hot10'
  | 'fish' | 'missions' | 'shop' | 'captains'
  | 'camUp' | 'camDown' | 'camLeft' | 'camRight' | 'camCenter' | 'camMode'
  | 'dock' | 'maps' | 'inventory' | 'profile' | 'ranking' | 'guild' | 'chat' | 'escape' | 'pvp';

export interface KeyDef { action: Action; label: string; group: string; def: string }

export const KEY_DEFS: KeyDef[] = [
  { action: 'attack', label: 'Attaquer la cible', group: 'Combat', def: 'KeyA' },
  { action: 'cancelAttack', label: 'Annuler l\'attaque', group: 'Combat', def: 'KeyE' },
  { action: 'fireBoth', label: 'Tirer une salve', group: 'Combat', def: 'Space' },
  { action: 'hot1', label: 'Munition 1', group: 'Barre rapide', def: 'Digit1' },
  { action: 'hot2', label: 'Munition 2', group: 'Barre rapide', def: 'Digit2' },
  { action: 'hot3', label: 'Munition 3', group: 'Barre rapide', def: 'Digit3' },
  { action: 'hot4', label: 'Munition 4', group: 'Barre rapide', def: 'Digit4' },
  { action: 'hot5', label: 'Munition 5', group: 'Barre rapide', def: 'Digit5' },
  { action: 'hot6', label: 'Munition 6', group: 'Barre rapide', def: 'Digit6' },
  { action: 'hot7', label: 'Munition 7', group: 'Barre rapide', def: 'Digit7' },
  { action: 'hot8', label: 'Objet 1', group: 'Barre rapide', def: 'Digit8' },
  { action: 'hot9', label: 'Objet 2', group: 'Barre rapide', def: 'Digit9' },
  { action: 'hot10', label: 'Objet 3', group: 'Barre rapide', def: 'Digit0' },
  { action: 'camUp', label: 'Caméra haut', group: 'Caméra', def: 'KeyT' },
  { action: 'camDown', label: 'Caméra bas', group: 'Caméra', def: 'KeyG' },
  { action: 'camLeft', label: 'Caméra gauche', group: 'Caméra', def: 'KeyF' },
  { action: 'camRight', label: 'Caméra droite', group: 'Caméra', def: 'KeyH' },
  { action: 'camCenter', label: 'Centrer la caméra', group: 'Caméra', def: 'KeyX' },
  { action: 'camMode', label: 'Vue du dessus / vue 3D', group: 'Caméra', def: 'KeyV' },
  { action: 'sailUp', label: 'Voilure +', group: 'Navigation au clavier', def: 'ArrowUp' },
  { action: 'sailDown', label: 'Voilure −', group: 'Navigation au clavier', def: 'ArrowDown' },
  { action: 'left', label: 'Barre à bâbord', group: 'Navigation au clavier', def: 'ArrowLeft' },
  { action: 'right', label: 'Barre à tribord', group: 'Navigation au clavier', def: 'ArrowRight' },
  { action: 'dock', label: 'Accoster', group: 'Autres', def: 'KeyP' },
  { action: 'maps', label: 'Cartes', group: 'Autres', def: 'KeyM' },
  { action: 'missions', label: 'Missions', group: 'Autres', def: 'KeyJ' },
  { action: 'shop', label: 'Boutique', group: 'Autres', def: 'KeyO' },
  { action: 'captains', label: 'Capitaines', group: 'Autres', def: 'KeyL' },
  { action: 'fish', label: 'Pêcher', group: 'Autres', def: 'KeyN' },
  { action: 'inventory', label: 'Inventaire', group: 'Autres', def: 'KeyI' },
  { action: 'profile', label: 'Profil', group: 'Autres', def: 'KeyC' },
  { action: 'ranking', label: 'Classements', group: 'Autres', def: 'KeyK' },
  { action: 'guild', label: 'Guilde', group: 'Autres', def: 'KeyU' },
  { action: 'pvp', label: 'Pavillon de combat', group: 'Autres', def: 'KeyB' },
  { action: 'chat', label: 'Chat', group: 'Autres', def: 'Enter' },
];

export const defaultKeys = (): Record<string, string> => Object.fromEntries(KEY_DEFS.map((k) => [k.action, k.def]));

/** Libellé lisible d'une touche, selon la disposition du clavier quand le navigateur la connaît. */
let layout: Map<string, string> | null = null;
try {
  (navigator as unknown as { keyboard?: { getLayoutMap(): Promise<Map<string, string>> } }).keyboard?.getLayoutMap().then((m) => { layout = m; }).catch(() => {});
} catch { /* non disponible */ }
export function keyLabel(code: string) {
  if (!code) return '—';
  if (code.startsWith('Digit')) return code.slice(5);
  const special: Record<string, string> = { Space: 'Espace', Enter: 'Entrée', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Échap', ShiftLeft: 'Maj', ControlLeft: 'Ctrl', Tab: 'Tab' };
  if (special[code]) return special[code];
  const l = layout?.get(code);
  if (l) return l.toUpperCase();
  return code.replace(/^Key/, '').replace(/^Numpad/, 'Pavé ');
}

export class Input {
  readonly held = new Set<Action>();
  private listeners: ((a: Action) => void)[] = [];
  private bind = new Map<string, Action>();
  mouseX = 0;
  mouseY = 0;
  dragging = false;
  private down: { x: number; y: number; button: number } | null = null;
  private moved = 0;
  onDrag: ((dx: number, dy: number, button: number) => void) | null = null;
  onWheel: ((d: number) => void) | null = null;
  onClick: ((x: number, y: number) => void) | null = null;
  /** Capture de la prochaine touche (écran de configuration des touches). */
  capture: ((code: string) => void) | null = null;

  constructor(private el: HTMLElement, keys: Record<string, string>) {
    this.setKeys(keys);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', () => this.held.clear());
    el.addEventListener('pointerdown', this.pDown);
    window.addEventListener('pointermove', this.pMove);
    window.addEventListener('pointerup', this.pUp);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.onWheel?.(e.deltaY); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setKeys(keys: Record<string, string>) {
    this.bind.clear();
    for (const k of KEY_DEFS) {
      const code = keys[k.action] ?? k.def;
      if (code) this.bind.set(code, k.action);
    }
    this.bind.set('Escape', 'escape');
  }

  on(fn: (a: Action) => void) { this.listeners.push(fn); }

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }

  private keyDown = (e: KeyboardEvent) => {
    if (this.capture) {
      e.preventDefault();
      const c = this.capture;
      this.capture = null;
      c(e.code);
      return;
    }
    if (this.typing(e)) {
      if (e.code === 'Escape') (e.target as HTMLElement).blur();
      return;
    }
    const a = this.bind.get(e.code);
    if (!a) return;
    if (a === 'fireBoth' || a === 'chat' || a.startsWith('hot') || a.startsWith('cam')) e.preventDefault();
    if (!this.held.has(a) && !e.repeat) for (const l of this.listeners) l(a);
    this.held.add(a);
  };
  private keyUp = (e: KeyboardEvent) => {
    const a = this.bind.get(e.code);
    if (a) this.held.delete(a);
  };
  private pDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY, button: e.button };
    this.moved = 0;
  };
  private pMove = (e: PointerEvent) => {
    const dx = e.clientX - this.mouseX, dy = e.clientY - this.mouseY;
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    if (this.down) {
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.moved > 6 || this.down.button === 2) {
        this.dragging = true;
        this.onDrag?.(dx, dy, this.down.button);
      }
    }
  };
  private pUp = (e: PointerEvent) => {
    if (this.down && this.down.button === 0 && this.moved <= 6 && e.target === this.el) this.onClick?.(e.clientX, e.clientY);
    this.down = null;
    this.dragging = false;
  };
}
