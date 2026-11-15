// Entrées clavier et souris. On utilise les codes physiques (e.code) : ZQSD sur AZERTY = WASD sur QWERTY.
export type Action =
  | 'sailUp' | 'sailDown' | 'left' | 'right' | 'fireBoth' | 'fireBabord' | 'fireTribord'
  | 'ammo1' | 'ammo2' | 'ammo3' | 'ammo4' | 'ammo5' | 'kit' | 'seau' | 'poudre'
  | 'dock' | 'map' | 'inventory' | 'profile' | 'ranking' | 'guild' | 'chat' | 'escape' | 'pvp' | 'camera';

const BIND: Record<string, Action> = {
  KeyW: 'sailUp', ArrowUp: 'sailUp', KeyS: 'sailDown', ArrowDown: 'sailDown',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'fireBoth', KeyQ: 'fireBabord', KeyE: 'fireTribord',
  Digit1: 'ammo1', Digit2: 'ammo2', Digit3: 'ammo3', Digit4: 'ammo4', Digit5: 'ammo5',
  KeyR: 'kit', KeyF: 'seau', KeyG: 'poudre',
  KeyP: 'dock', KeyM: 'map', KeyI: 'inventory', KeyC: 'profile', KeyK: 'ranking', KeyU: 'guild',
  Enter: 'chat', Escape: 'escape', KeyB: 'pvp', KeyV: 'camera',
};

export class Input {
  readonly held = new Set<Action>();
  private listeners: ((a: Action) => void)[] = [];
  mouseX = 0;
  mouseY = 0;
  dragging = false;
  private down: { x: number; y: number; button: number } | null = null;
  private moved = 0;
  onDrag: ((dx: number, dy: number) => void) | null = null;
  onWheel: ((d: number) => void) | null = null;
  onClick: ((x: number, y: number) => void) | null = null;
  enabled = true;

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', () => this.held.clear());
    el.addEventListener('pointerdown', this.pDown);
    window.addEventListener('pointermove', this.pMove);
    window.addEventListener('pointerup', this.pUp);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.onWheel?.(e.deltaY); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  on(fn: (a: Action) => void) { this.listeners.push(fn); }

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  private keyDown = (e: KeyboardEvent) => {
    if (this.typing(e)) {
      if (e.code === 'Escape') (e.target as HTMLElement).blur();
      return;
    }
    const a = BIND[e.code];
    if (!a) return;
    if (a === 'fireBoth' || a === 'chat' || a.startsWith('ammo')) e.preventDefault();
    if (!this.held.has(a) && !e.repeat) for (const l of this.listeners) l(a);
    this.held.add(a);
  };
  private keyUp = (e: KeyboardEvent) => {
    const a = BIND[e.code];
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
      if (this.moved > 5 || this.down.button === 2) {
        this.dragging = true;
        this.onDrag?.(dx, dy);
      }
    }
  };
  private pUp = (e: PointerEvent) => {
    if (this.down && this.down.button === 0 && this.moved <= 5 && e.target === this.el) this.onClick?.(e.clientX, e.clientY);
    this.down = null;
    this.dragging = false;
  };
}
