// Monstres marins en 3D, animés : crocodile géant, requin-marteau, serpent de mer, kraken, léviathan.
// Même interface que ShipModel pour que le moteur les traite comme des navires (flottaison, étiquettes, dégâts).
import * as THREE from 'three';
import type { MonsterKind, ShipDef } from '../../../../shared/ships';

interface Seg { mesh: THREE.Object3D; base: THREE.Vector3; phase: number; amp: number; kind: 'body' | 'tail' | 'tentacle' | 'fin' }

export class MonsterModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly dims: { L: number; B: number; F: number; draft: number; decks: number; masts: [] };
  readonly firePoints: THREE.Vector3[] = [];
  readonly ports = { babord: [] as THREE.Vector3[], tribord: [] as THREE.Vector3[] };
  readonly lanternPos: THREE.Vector3[] = [];
  private segs: Seg[] = [];
  private skin: THREE.MeshStandardMaterial;
  private belly: THREE.MeshStandardMaterial;
  private eye: THREE.MeshStandardMaterial;
  private kind: MonsterKind;

  constructor(readonly def: ShipDef) {
    this.kind = def.look.monster!;
    const glow = def.look.glow ?? 0;
    this.skin = new THREE.MeshStandardMaterial({ color: def.look.hull, roughness: 0.55, metalness: 0.15, flatShading: true, emissive: new THREE.Color(glow), emissiveIntensity: glow ? 0.35 : 0 });
    this.belly = new THREE.MeshStandardMaterial({ color: def.look.stripe, roughness: 0.6, flatShading: true });
    this.eye = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(def.look.trim), emissiveIntensity: 1.6 });
    const build = { crocodile: () => this.crocodile(), requin: () => this.requin(), serpent: () => this.serpent(), kraken: () => this.kraken(), leviathan: () => this.leviathan() };
    const L = build[this.kind]();
    this.dims = { L, B: L * 0.3, F: 3, draft: 3, decks: 0, masts: [] };
    for (let i = 0; i < 4; i++) this.firePoints.push(new THREE.Vector3((Math.random() - 0.5) * L * 0.2, 2, (Math.random() - 0.5) * L * 0.6));
    this.body.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    this.root.add(this.body);
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, kind: Seg['kind'] = 'body', phase = 0, amp = 0, parent: THREE.Object3D = this.body) {
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    parent.add(m);
    if (amp) this.segs.push({ mesh: m, base: pos.clone(), phase, amp, kind });
    return m;
  }

  private eyes(x: number, y: number, z: number, r: number) {
    for (const s of [1, -1]) this.add(new THREE.SphereGeometry(r, 8, 6), this.eye, new THREE.Vector3(s * x, y, z));
  }

  private crocodile() {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // Corps : segments écailleux qui ondulent, museau long, queue effilée, pattes.
    for (let i = 0; i < 7; i++) {
      const r = 3.2 - Math.abs(i - 2) * 0.35;
      const g = new THREE.SphereGeometry(r, 9, 6).scale(1.15, 0.55, 1.4);
      this.add(g, this.skin, V(0, 0.4, 8 - i * 3.2), 'body', i * 0.6, 0.35);
      // crêtes dorsales
      this.add(new THREE.ConeGeometry(0.5, 1.3, 4), this.skin, V(0, 0.4 + r * 0.55, 8 - i * 3.2), 'body', i * 0.6, 0.35);
    }
    for (let i = 0; i < 6; i++) {
      const r = 1.6 - i * 0.24;
      this.add(new THREE.SphereGeometry(Math.max(0.3, r), 8, 5).scale(1, 0.6, 1.8), this.skin, V(0, 0.2, -12 - i * 2.4), 'tail', i * 0.7, 1.2 + i * 0.5);
    }
    this.add(new THREE.BoxGeometry(2.6, 1.2, 7).translate(0, 0, 3.5), this.skin, V(0, 0.6, 11));
    this.add(new THREE.BoxGeometry(2.4, 0.5, 6.5).translate(0, 0, 3.2), this.belly, V(0, 0, 11));
    for (let k = 0; k < 6; k++) for (const s of [1, -1]) this.add(new THREE.ConeGeometry(0.15, 0.6, 4).rotateX(Math.PI), this.belly, V(s * 1.1, 0.1, 12 + k * 1.1));
    this.eyes(1.0, 1.6, 11.6, 0.42);
    for (const [x, z] of [[2.6, 6], [-2.6, 6], [2.4, -4], [-2.4, -4]]) this.add(new THREE.CylinderGeometry(0.5, 0.7, 2.2, 6).rotateZ(x > 0 ? -0.9 : 0.9), this.skin, V(x, -0.6, z), 'fin', z, 0.4);
    return 34;
  }

  private requin() {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    this.add(new THREE.SphereGeometry(3, 12, 8).scale(1, 0.85, 4), this.skin, V(0, -0.6, 0), 'body', 0, 0.2);
    this.add(new THREE.SphereGeometry(2.8, 12, 8).scale(0.95, 0.5, 3.6), this.belly, V(0, -1.6, 0.5));
    // Tête en marteau
    this.add(new THREE.BoxGeometry(10, 1.1, 2.4), this.skin, V(0, -0.2, 12.2));
    this.eyes(5, 0.1, 12.2, 0.55);
    // Aileron dorsal hors de l'eau, nageoires, queue
    this.add(new THREE.ConeGeometry(2.6, 6, 4).scale(0.35, 1, 1).rotateX(-0.35), this.skin, V(0, 3.2, 1));
    for (const s of [1, -1]) this.add(new THREE.ConeGeometry(1.4, 5, 4).scale(0.3, 1, 1).rotateZ(s * 1.3), this.skin, V(s * 3.5, -1.5, 4), 'fin', s, 0.3);
    const tail = new THREE.Group();
    tail.position.set(0, -0.4, -12);
    this.body.add(tail);
    this.segs.push({ mesh: tail, base: tail.position.clone(), phase: 0, amp: 1.6, kind: 'tail' });
    this.add(new THREE.ConeGeometry(1.6, 6, 4).scale(0.3, 1, 1).rotateX(0.7), this.skin, V(0, 2, -1.5), 'body', 0, 0, tail);
    this.add(new THREE.ConeGeometry(1.2, 4, 4).scale(0.3, 1, 1).rotateX(2.4), this.skin, V(0, -1.6, -1.2), 'body', 0, 0, tail);
    return 30;
  }

  private serpent() {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // Anneaux qui sortent et plongent dans l'eau.
    const n = 16;
    for (let i = 0; i < n; i++) {
      const r = 2.6 - Math.abs(i - 3) * 0.12;
      this.add(new THREE.SphereGeometry(Math.max(0.8, r), 10, 7), i % 2 ? this.skin : this.belly, V(0, 0, 18 - i * 2.6), 'body', i * 0.55, 3.2);
      if (i % 2 === 0 && i < n - 2) this.add(new THREE.ConeGeometry(0.7, 2.6, 4), this.eye, V(0, Math.max(0.8, r) + 1, 18 - i * 2.6), 'body', i * 0.55, 3.2);
    }
    const head = this.add(new THREE.ConeGeometry(2.6, 7, 6).rotateX(Math.PI / 2), this.skin, V(0, 3, 22), 'body', -0.55, 3.2);
    void head;
    this.eyes(1.4, 4.3, 21.5, 0.55);
    for (const s of [1, -1]) this.add(new THREE.ConeGeometry(0.5, 3.5, 4).rotateX(-0.6).rotateZ(s * 0.5), this.eye, V(s * 1.4, 5.6, 20.5), 'body', -0.55, 3.2);
    return 44;
  }

  private kraken() {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // Manteau bombé hors de l'eau et huit tentacules qui fouettent la surface.
    this.add(new THREE.SphereGeometry(9, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1, 1.25, 1.15), this.skin, V(0, -2, 0), 'body', 0, 0.5);
    for (let k = 0; k < 14; k++) this.add(new THREE.SphereGeometry(0.9 + Math.random() * 0.6, 6, 5), this.belly, V((Math.random() - 0.5) * 12, 3 + Math.random() * 6, (Math.random() - 0.5) * 12));
    this.eyes(4.2, 2.6, 7.5, 1.4);
    for (let t = 0; t < 8; t++) {
      const a = (t / 8) * Math.PI * 2;
      const g = new THREE.Group();
      g.position.set(Math.sin(a) * 8, 0, Math.cos(a) * 8);
      g.rotation.y = a;
      this.body.add(g);
      for (let j = 0; j < 9; j++) {
        const r = 1.6 - j * 0.15;
        const m = this.add(new THREE.SphereGeometry(Math.max(0.3, r), 7, 5), j % 2 ? this.skin : this.belly, V(0, 0, j * 2.2), 'tentacle', t * 0.8 + j * 0.35, 0.6 + j * 0.45, g);
        void m;
      }
    }
    return 42;
  }

  private leviathan() {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // Immense dos de baleine-serpent, constellé de lumières bleues.
    const n = 14;
    for (let i = 0; i < n; i++) {
      const r = 7 - Math.abs(i - 3) * 0.4;
      this.add(new THREE.SphereGeometry(Math.max(1.6, r), 14, 9).scale(1.2, 0.7, 1.4), this.skin, V(0, -1.5, 30 - i * 5), 'body', i * 0.35, 1.6);
      for (const s of [1, -1]) this.add(new THREE.SphereGeometry(0.6, 6, 5), this.eye, V(s * Math.max(1.6, r) * 0.9, 1, 30 - i * 5), 'body', i * 0.35, 1.6);
      if (i % 3 === 0) this.add(new THREE.ConeGeometry(1.4, 5, 4).scale(0.4, 1, 1), this.belly, V(0, Math.max(1.6, r) * 0.6, 30 - i * 5), 'body', i * 0.35, 1.6);
    }
    this.add(new THREE.SphereGeometry(8, 14, 10).scale(1.1, 0.8, 1.6), this.skin, V(0, 0, 38), 'body', -0.35, 1.6);
    this.eyes(4.5, 2.5, 46, 1.2);
    for (const s of [1, -1]) this.add(new THREE.ConeGeometry(4, 14, 4).scale(0.3, 1, 1).rotateZ(s * 1.2), this.skin, V(s * 9, -2, 26), 'fin', s, 0.8);
    return 80;
  }

  update(t: number, _dt: number, _sail: number, _windRel: number, _ws: number, damage: number, _sd: number, night: number) {
    const k = this.kind;
    for (const s of this.segs) {
      const ph = t * (k === 'kraken' ? 1.6 : 2.2) + s.phase;
      if (s.kind === 'body') {
        if (k === 'serpent' || k === 'leviathan') s.mesh.position.y = s.base.y + Math.sin(ph) * s.amp;
        else s.mesh.position.x = s.base.x + Math.sin(ph) * s.amp;
      } else if (s.kind === 'tail') {
        s.mesh.position.x = s.base.x + Math.sin(ph * 1.3) * s.amp;
        s.mesh.rotation.y = Math.cos(ph * 1.3) * 0.4;
      } else if (s.kind === 'tentacle') {
        s.mesh.position.y = s.base.y + Math.sin(ph) * s.amp + s.amp * 0.6;
        s.mesh.position.x = s.base.x + Math.cos(ph * 0.7) * s.amp * 0.5;
      } else if (s.kind === 'fin') {
        s.mesh.rotation.x = Math.sin(ph) * s.amp;
      }
    }
    this.skin.color.setHex(this.def.look.hull).lerp(new THREE.Color(0x1a0a05), damage * 0.6);
    this.eye.emissiveIntensity = 1 + night * 2;
  }

  dispose() {
    this.body.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.skin.dispose();
    this.belly.dispose();
    this.eye.dispose();
  }
}
