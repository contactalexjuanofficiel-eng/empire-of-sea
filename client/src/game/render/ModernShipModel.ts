// Générateur 3D des navires modernes à moteur : pêche, vedettes, patrouilleurs, frégates.
// Coque en acier à couples (étrave, tableau arrière, flottaison), superstructures, mâts et radars tournants,
// armement, embarcations, rambardes, hélices et gouvernails. Même interface que ShipModel.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ModernSpec } from '../../../../shared/modern';
import type { ShipDef } from '../../../../shared/ships';
import { flagTexture } from './textures';

// ---------------------------------------------------------------- matériaux partagés (réutilisés par tous les navires)
const MAT = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material) {
  let m = MAT.get(key);
  if (!m) { m = make(); MAT.set(key, m); }
  return m;
}
const paint = (c: number, rough = 0.5, metal = 0.35) => mat(`p${c}:${rough}:${metal}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }));
const glass = () => mat('glass', () => new THREE.MeshStandardMaterial({ color: 0x0c1824, roughness: 0.08, metalness: 0.9, emissive: 0x2a3a4a, emissiveIntensity: 0.15 }));
const dark = () => paint(0x22262c, 0.6, 0.5);
const black = () => paint(0x111214, 0.7, 0.2);
const white = () => paint(0xf2f2ee, 0.45, 0.1);
const orange = () => paint(0xf07020, 0.5, 0.05);
const rubber = () => paint(0x2a2a2a, 0.9, 0);
const bronze = () => paint(0xb8893a, 0.3, 0.9);

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const texCache = new Map<string, THREE.Texture>();
function tex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key);
  if (!t) { t = canvasTex(w, h, draw); texCache.set(key, t); }
  return t;
}
const netTex = () => tex('net', 128, 128, (g) => {
  g.fillStyle = '#1f3a2a'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#5a8a6a'; g.lineWidth = 2;
  for (let i = -128; i < 256; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke(); g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke(); }
});
const vlsTex = () => tex('vls', 256, 128, (g) => {
  g.fillStyle = '#5a646e'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
    g.fillStyle = '#4a545e'; g.fillRect(6 + i * 31, 6 + j * 30, 27, 26);
    g.strokeStyle = '#2a3036'; g.lineWidth = 2; g.strokeRect(6 + i * 31, 6 + j * 30, 27, 26);
    g.fillStyle = '#3a4048'; g.beginPath(); g.arc(19 + i * 31, 19 + j * 30, 6, 0, 7); g.fill();
  }
});
const padTex = () => tex('pad', 256, 256, (g) => {
  g.fillStyle = '#3e464e'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#f2f2f2'; g.lineWidth = 6;
  g.beginPath(); g.arc(128, 128, 80, 0, 7); g.stroke();
  g.strokeStyle = '#f0c020'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(128, 10); g.lineTo(128, 246); g.stroke();
  g.fillStyle = '#f2f2f2'; g.font = 'bold 90px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 132);
});
function textTex(text: string, color: string, bg = 'rgba(0,0,0,0)') {
  return tex(`t:${text}:${color}`, 512, 128, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.fillStyle = color; g.font = 'bold 84px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 68);
  });
}
const tricolorTex = () => tex('tri', 256, 128, (g) => {
  g.clearRect(0, 0, 256, 128);
  const c = ['#1f3a8a', '#f4f1e6', '#c3242b'];
  c.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.moveTo(40 + i * 50, 0); g.lineTo(90 + i * 50, 0); g.lineTo(40 + i * 50, 128); g.lineTo(-10 + i * 50, 128); g.fill(); });
});

// ---------------------------------------------------------------- coque d'acier
export interface HullShape { L: number; B: number; draft: number; F: number; transom: number; vpow: number; flare: number; rake: number; sheer: number; knuckle?: boolean }

export function hullHalfWidth(h: HullShape, t: number) {
  if (t < 0.55) return h.transom + (1 - h.transom) * Math.sin((t / 0.55) * Math.PI / 2);
  return Math.pow(Math.max(0, Math.cos(((t - 0.55) / 0.45) * Math.PI / 2)), 0.75);
}
export const deckAt = (h: HullShape, t: number) => h.F * (1 + h.sheer * Math.pow(Math.max(0, (t - 0.55) / 0.45), 2));

export function buildSteelHull(h: HullShape, colHull: number, colBoot: number) {
  const S = 44;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const cH = new THREE.Color(colHull), cAnti = new THREE.Color(0x7a2a22), cBoot = new THREE.Color(colBoot);
  const rowsFor = (top: number) => {
    const ys = [-h.draft, -h.draft * 0.75, -h.draft * 0.45, -h.draft * 0.2, -0.25, 0.35, top * 0.35, top * 0.7, top * 0.92, top];
    return ys;
  };
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    let rows = 0;
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const top = deckAt(h, t) + 0.9;
      const ys = rowsFor(top);
      rows = ys.length;
      for (const y of ys) {
        const yn = (y + h.draft) / (top + h.draft);
        const wf = h.draft / (top + h.draft);
        let shape: number;
        if (yn < wf) shape = 0.06 + 0.94 * Math.pow(yn / wf, h.vpow);
        else shape = 1 + h.flare * ((yn - wf) / (1 - wf));
        if (h.knuckle && yn > 0.82) shape -= (yn - 0.82) * 0.25;
        const x = side * (h.B / 2) * hullHalfWidth(h, t) * shape;
        let z = -h.L / 2 + t * h.L;
        if (t > 0.78) z += Math.pow((t - 0.78) / 0.22, 2) * h.L * h.rake * yn;
        pos.push(x, y, z);
        const c = y < -0.25 ? cAnti : y < 0.35 ? cBoot : cH;
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < S; i++) for (let j = 0; j < rows - 1; j++) {
      const a = base + i * rows + j, b = a + rows;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Tableau arrière
  const R = pos.length / 6;
  const rows = R / (S + 1);
  for (let j = 0; j < rows - 1; j++) idx.push(j, j + 1, R + j, R + j, j + 1, R + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- outils de construction
class Kit {
  readonly main: THREE.BufferGeometry[] = []; // fusionné : peinture de superstructure
  readonly parts: { geo: THREE.BufferGeometry; mat: THREE.Material; detail: boolean }[] = [];
  constructor(readonly h: HullShape) {}
  zAt(t: number) { return -this.h.L / 2 + t * this.h.L; }
  deck(t: number) { return deckAt(this.h, t); }
  hw(t: number) { return (this.h.B / 2) * hullHalfWidth(this.h, t) * (1 + this.h.flare * 0.9); }
  box(w: number, hh: number, d: number, x: number, y: number, z: number, m?: THREE.Material, detail = false, rotY = 0) {
    const g = new THREE.BoxGeometry(w, hh, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + hh / 2, z);
    this.put(g, m, detail);
    return g;
  }
  cyl(r0: number, r1: number, len: number, x: number, y: number, z: number, m?: THREE.Material, detail = false, rot?: [number, number, number], seg = 10) {
    const g = new THREE.CylinderGeometry(r1, r0, len, seg);
    g.translate(0, len / 2, 0);
    if (rot) { g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); }
    g.translate(x, y, z);
    this.put(g, m, detail);
    return g;
  }
  /** Bloc à faces inclinées (furtif) : profil trapézoïdal extrudé sur la largeur. */
  slant(w: number, hh: number, dBottom: number, dTop: number, x: number, y: number, z: number, m?: THREE.Material, inset = 0) {
    const s = new THREE.Shape();
    s.moveTo(-dBottom / 2, 0); s.lineTo(dBottom / 2, 0); s.lineTo(dTop / 2, hh); s.lineTo(-dTop / 2, hh); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    g.translate(0, 0, -w / 2);
    g.rotateY(Math.PI / 2);
    // Côtés inclinés : on rétrécit le haut sur la largeur.
    if (inset) {
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const yy = p.getY(i); p.setX(i, p.getX(i) * (1 - inset * (yy / hh))); }
      g.computeVertexNormals();
    }
    g.translate(x, y, z);
    this.put(g, m, false);
    return g;
  }
  put(g: THREE.BufferGeometry, m?: THREE.Material, detail = false) {
    if (!m) this.main.push(g.index ? g.toNonIndexed() : g);
    else this.parts.push({ geo: g, mat: m, detail });
  }
  /** Bandeau de vitres sur une face avant/arrière (z) ou latérale (x). */
  windows(w: number, hh: number, x: number, y: number, z: number, side: 'avant' | 'arriere' | 'cotes', depth = 0) {
    if (side === 'cotes') {
      for (const s of [1, -1]) this.box(0.08, hh, depth, x + (s * w) / 2, y, z, glass(), false);
    } else this.box(w, hh, 0.08, x, y, z, glass(), false);
  }
  railing(t0: number, t1: number) {
    const pts: number[] = [];
    const n = 24;
    for (const s of [1, -1]) for (let i = 0; i < n; i++) {
      const ta = t0 + ((t1 - t0) * i) / n, tb = t0 + ((t1 - t0) * (i + 1)) / n;
      const xa = s * this.hw(ta) * 0.97, xb = s * this.hw(tb) * 0.97;
      const ya = this.deck(ta) + 1, yb = this.deck(tb) + 1;
      pts.push(xa, ya, this.zAt(ta), xb, yb, this.zAt(tb));
      pts.push(xa, ya - 0.5, this.zAt(ta), xb, yb - 0.5, this.zAt(tb));
      pts.push(xa, ya, this.zAt(ta), xa, ya - 1, this.zAt(ta));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }
  propellers(n: number, r: number) {
    const z = this.zAt(0.06);
    const y = -this.h.draft * 0.65;
    for (let k = 0; k < n; k++) {
      const x = n === 1 ? 0 : (k - (n - 1) / 2) * this.h.B * 0.35;
      this.cyl(r * 0.25, r * 0.2, r * 0.6, x, y, z, bronze(), true, [Math.PI / 2, 0, 0], 8);
      for (let b = 0; b < 5; b++) {
        const g = new THREE.BoxGeometry(r * 0.32, r, 0.06);
        g.translate(0, r * 0.5, 0);
        g.rotateZ((b / 5) * Math.PI * 2);
        g.rotateY(0.3);
        g.translate(x, y, z + r * 0.3);
        this.put(g, bronze(), true);
      }
      this.box(0.25, this.h.draft * 0.6, r * 1.6, x, -this.h.draft * 0.85, z - r * 1.4, dark(), true);
    }
  }
  /** Embarcation semi-rigide (bouée orange + coque grise). */
  rhib(x: number, y: number, z: number, len: number) {
    const g = new THREE.CapsuleGeometry(len * 0.13, len * 0.75, 4, 8).rotateX(Math.PI / 2);
    g.translate(x, y + len * 0.12, z);
    this.put(g, orange(), true);
    this.box(len * 0.2, len * 0.12, len * 0.8, x, y, z, paint(0x5a5f66), true);
    this.box(len * 0.12, len * 0.18, len * 0.15, x, y + len * 0.1, z - len * 0.25, black(), true);
  }
  radar(x: number, y: number, z: number, len: number, list: THREE.Object3D[]) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, len * 0.12, len * 0.18), white());
    bar.position.y = len * 0.12;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(len * 0.05, len * 0.06, len * 0.15, 8), dark());
    g.add(bar, post);
    list.push(g);
    return g;
  }
  antenna(x: number, y: number, z: number, len: number) {
    this.cyl(0.05, 0.03, len, x, y, z, dark(), true, undefined, 5);
  }
  turret(x: number, y: number, z: number, size: number, barrel: number, m: THREE.Material) {
    // Tourelle furtive à facettes et long tube.
    const s = new THREE.CylinderGeometry(size * 0.55, size * 0.8, size * 0.7, 6);
    s.translate(x, y + size * 0.35, z);
    this.put(s, m);
    this.cyl(size * 0.12, size * 0.09, barrel, x, y + size * 0.4, z + size * 0.4, dark(), false, [Math.PI / 2, 0, 0], 8);
  }
}

// ---------------------------------------------------------------- navire
export class ModernShipModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly dims: { L: number; B: number; F: number; draft: number; decks: number; masts: [] };
  readonly firePoints: THREE.Vector3[] = [];
  readonly ports = { babord: [] as THREE.Vector3[], tribord: [] as THREE.Vector3[] };
  readonly lanternPos: THREE.Vector3[] = [];
  private hullMat: THREE.MeshStandardMaterial;
  private details = new THREE.Group();
  private radars: THREE.Object3D[] = [];
  private lights: THREE.MeshStandardMaterial;
  private rotor: THREE.Object3D | null = null;
  private flagU = { uTime: { value: 0 } };
  private own: THREE.Material[] = [];

  constructor(readonly def: ShipDef) {
    const sp = def.modern as ModernSpec;
    const L = def.size?.L ?? 40, B = def.size?.B ?? 9;
    const shapes: Record<ModernSpec['type'], Partial<HullShape>> = {
      peche: { draft: B * 0.34, F: B * 0.33, transom: 0.86, vpow: 0.75, flare: 0.04, rake: 0.05, sheer: 0.55 },
      vedette: { draft: B * 0.22, F: B * 0.28, transom: 0.92, vpow: 0.55, flare: 0.06, rake: 0.09, sheer: 0.4 },
      patrouilleur: { draft: B * 0.28, F: B * 0.3, transom: 0.86, vpow: 0.7, flare: 0.08, rake: 0.07, sheer: 0.35 },
      fregate: { draft: B * 0.3, F: B * 0.42, transom: 0.8, vpow: 0.72, flare: 0.07, rake: sp.variant === 'fdi' ? -0.04 : 0.08, sheer: 0.18, knuckle: sp.variant === 'lafayette' || sp.variant === 'fdi' },
    };
    const h = { L, B, ...shapes[sp.type] } as HullShape;
    this.dims = { L, B, F: h.F, draft: h.draft, decks: 0, masts: [] };
    const k = new Kit(h);

    // Coque, pont, rambardes
    this.hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.35 });
    this.own.push(this.hullMat);
    const hull = new THREE.Mesh(buildSteelHull(h, sp.hull, sp.type === 'fregate' || sp.type === 'patrouilleur' ? 0x1a1c20 : 0xf2f2ee), this.hullMat);
    hull.castShadow = hull.receiveShadow = true;
    this.body.add(hull);
    const deckPts: number[] = [], deckIdx: number[] = [];
    for (let i = 0; i <= 30; i++) {
      const t = 0.01 + (i / 30) * 0.97;
      const w = k.hw(t) * 0.95;
      deckPts.push(-w, k.deck(t), k.zAt(t), w, k.deck(t), k.zAt(t));
      if (i < 30) { const a = i * 2; deckIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(deckPts, 3));
    dg.setIndex(deckIdx);
    dg.computeVertexNormals();
    const deck = new THREE.Mesh(dg, paint(sp.deck, 0.85, 0.1));
    deck.receiveShadow = true;
    this.body.add(deck);
    const rails = new THREE.LineSegments(k.railing(0.04, 0.97), mat('rail', () => new THREE.LineBasicMaterial({ color: 0xd8dde2 })));
    this.details.add(rails);

    // Numéro et inscription peints sur la coque
    const deckMid = k.deck(0.5);
    if (sp.number) for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(B * 0.9, B * 0.22), new THREE.MeshBasicMaterial({ map: textTex(sp.number, sp.type === 'fregate' || sp.type === 'patrouilleur' ? '#f2f2f2' : '#ffffff'), transparent: true, depthWrite: false }));
      p.position.set(s * (k.hw(0.84) + 0.06), k.deck(0.84) * 0.62, k.zAt(0.84));
      p.rotation.y = s * Math.PI / 2;
      if (s < 0) p.scale.x = 1;
      this.details.add(p);
    }
    if (sp.label) for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(B * 1.6, B * 0.2), new THREE.MeshBasicMaterial({ map: textTex(sp.label, '#ffffff'), transparent: true, depthWrite: false }));
      p.position.set(s * (k.hw(0.45) + 0.06), deckMid * 0.6, k.zAt(0.45));
      p.rotation.y = s * Math.PI / 2;
      this.details.add(p);
    }

    this.lights = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe0a0, emissiveIntensity: 0.4 });
    this.own.push(this.lights);

    // Équipements selon le type
    const top = paint(sp.top, 0.45, 0.25);
    const accent = paint(sp.accent, 0.5, 0.3);
    ({ peche: () => this.fishing(k, sp, top, accent), vedette: () => this.speedboat(k, sp, top, accent), patrouilleur: () => this.patrol(k, sp, top, accent), fregate: () => this.frigate(k, sp, top, accent) })[sp.type]();

    // Hélices et gouvernails ; ancres
    k.propellers(sp.type === 'vedette' ? 0 : sp.type === 'peche' ? 1 : 2, Math.min(2.4, B * 0.16));
    for (const s of [1, -1]) k.box(0.5, 1.2, 0.8, s * k.hw(0.9) * 0.95, k.deck(0.9) * 0.55, k.zAt(0.9), black(), true);

    // Fusion de la peinture de superstructure + pièces
    if (k.main.length) {
      const sup = new THREE.Mesh(mergeGeometries(k.main.map((g) => (g.attributes.uv ? g : g)).map((g) => { g.deleteAttribute('uv'); return g; }))!, top);
      sup.castShadow = sup.receiveShadow = true;
      this.body.add(sup);
    }
    const byMat = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; detail: boolean }>();
    for (const p of k.parts) {
      const key = byMat.get(p.mat) ?? { geos: [], detail: p.detail };
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      if (g.attributes.uv) g.deleteAttribute('uv');
      key.geos.push(g);
      key.detail = key.detail && p.detail;
      byMat.set(p.mat, key);
    }
    for (const [m, { geos, detail }] of byMat) {
      const mesh = new THREE.Mesh(mergeGeometries(geos)!, m);
      mesh.castShadow = true;
      (detail ? this.details : this.body).add(mesh);
    }
    for (const r of this.radars) this.details.add(r);
    this.body.add(this.details);

    // Pavillon à la poupe : tricolore pour la Marine, pavillon noir ou anglais pour les PNJ hostiles
    const fm = new THREE.MeshStandardMaterial({ map: flagTexture(def.npcOnly ? (def.id === 'm_fregate_hostile' ? 'anglais' : 'pirate') : 'tricolore'), side: THREE.DoubleSide });
    this.own.push(fm);
    const fs = Math.max(1.6, B * 0.22);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(fs * 1.5, fs, 8, 3).translate(-fs * 0.75, -fs * 0.5, 0), fm);
    flag.position.set(0, k.deck(0.02) + fs * 2.2, k.zAt(0.01));
    flag.rotation.y = Math.PI / 2;
    k.cyl(0.06, 0.05, fs * 2.3, 0, k.deck(0.02), k.zAt(0.01), dark(), true, undefined, 5);
    this.body.add(flag);
    fm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.flagU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fx = uv.x; transformed.z += sin(uTime * 6.0 - fx * 7.0) * fx * 0.15 * position.x;');
    };

    for (let i = 0; i < 4; i++) this.firePoints.push(new THREE.Vector3((Math.random() - 0.5) * B * 0.4, k.deck(0.5) + 1, (Math.random() - 0.5) * L * 0.6));
    this.root.add(this.body);
  }

  // ------------------------------------------------------------ pêche
  private fishing(k: Kit, sp: ModernSpec, top: THREE.Material, accent: THREE.Material) {
    const { B } = k.h;
    const v = sp.variant;
    const whT = v === 'caseyeur' ? 0.32 : v === 'fileyeur' ? 0.68 : v === 'hauturier' || v === 'thonier' ? 0.7 : 0.62;
    const z = k.zAt(whT), y = k.deck(whT);
    const lv = v === 'hauturier' || v === 'thonier' ? 2 : 1;
    const ww = B * 0.62, wd = k.h.L * (v === 'hauturier' ? 0.2 : 0.17);
    for (let l = 0; l < lv; l++) {
      const yy = y + l * 2.6;
      const sc = 1 - l * 0.12;
      k.box(ww * sc, 2.6, wd * sc, 0, yy, z);
      k.windows(ww * sc * 0.92, 0.9, 0, yy + 1.4, z + (wd * sc) / 2 + 0.03, 'avant');
      k.windows(ww * sc, 0.8, 0, yy + 1.45, z, 'cotes', wd * sc * 0.7);
    }
    const roofY = y + lv * 2.6;
    k.box(ww * 0.98, 0.2, wd * 0.98, 0, roofY, z, accent);
    // Mât, radar, feux, antennes
    k.cyl(0.18, 0.12, 5.5, 0, roofY, z - wd * 0.2, white(), true);
    k.box(0.12, 0.3, 0.3, 0.4, roofY + 4.5, z - wd * 0.2, this.lights, true);
    this.body.add(k.radar(0, roofY + 2.6, z - wd * 0.2, B * 0.32, this.radars));
    k.antenna(-ww * 0.35, roofY, z, 4);
    // Bouées couronnes
    for (const s of [1, -1]) {
      const g = new THREE.TorusGeometry(0.35, 0.1, 6, 14).rotateY(Math.PI / 2);
      g.translate(s * (ww / 2 + 0.06), y + 1.6, z - wd * 0.2);
      k.put(g, orange(), true);
    }
    k.cyl(0.25, 0.2, 2.2, ww * 0.25, roofY, z - wd * 0.45, dark(), false); // échappement
    if (v === 'chalutier' || v === 'hauturier') {
      // Portique arrière, tambour à filet, panneaux de chalut, treuils
      const gz = k.zAt(0.06), gy = k.deck(0.06);
      const gh = v === 'hauturier' ? 8 : 6;
      for (const s of [1, -1]) k.box(0.45, gh, 0.45, s * k.hw(0.06) * 0.8, gy, gz, accent);
      k.box(k.hw(0.06) * 1.7, 0.5, 0.5, 0, gy + gh, gz, accent);
      k.cyl(1.1, 1.1, B * 0.6, -B * 0.3, gy + 1.6, k.zAt(0.2), mat('netm', () => new THREE.MeshStandardMaterial({ map: netTex(), roughness: 0.9 })), true, [0, 0, Math.PI / 2], 14);
      for (const s of [1, -1]) k.box(0.2, 1.6, 2.4, s * k.hw(0.08) * 0.95, gy + gh * 0.5, gz + 0.6, accent, true);
      for (const s of [1, -1]) k.cyl(0.6, 0.6, 1.2, s * B * 0.22, k.deck(0.4) + 0.6, k.zAt(0.4), dark(), true, [0, 0, Math.PI / 2], 10);
      if (v === 'hauturier') {
        // Rampe arrière et grue
        k.slant(B * 0.4, 0.4, 5, 0.4, 0, k.deck(0.02) - 0.2, k.zAt(0.03), dark());
        k.cyl(0.25, 0.2, 7, B * 0.3, k.deck(0.45), k.zAt(0.45), accent, true, [0.9, 0, 0]);
      }
    }
    if (v === 'fileyeur') {
      k.cyl(0.5, 0.5, 1.4, k.hw(0.85) * 0.8, k.deck(0.85) + 0.8, k.zAt(0.86), dark(), true, [0, 0, Math.PI / 2]);
      for (let i = 0; i < 5; i++) {
        const g = new THREE.SphereGeometry(0.45, 8, 6).translate((i - 2) * 0.9, k.deck(0.2) + 0.5, k.zAt(0.18 + (i % 2) * 0.04));
        k.put(g, orange(), true);
        k.cyl(0.03, 0.03, 2.5, (i - 2) * 0.9, k.deck(0.2) + 0.8, k.zAt(0.18 + (i % 2) * 0.04), dark(), true, undefined, 4);
      }
      k.box(B * 0.5, 0.8, k.h.L * 0.15, 0, k.deck(0.25), k.zAt(0.28), mat('netm', () => new THREE.MeshStandardMaterial({ map: netTex(), roughness: 0.9 })), true);
    }
    if (v === 'caseyeur') {
      // Casiers empilés à l'avant
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) for (let l = 0; l < 2; l++) {
        k.box(1.1, 0.8, 1.1, (j - 1) * 1.25, k.deck(0.75) + l * 0.82, k.zAt(0.62 + i * 0.07), mat('pot', () => new THREE.MeshStandardMaterial({ map: netTex(), color: 0xc8b070, roughness: 0.9 })), true);
      }
      k.cyl(0.15, 0.12, 4, k.hw(0.55) * 0.7, k.deck(0.55), k.zAt(0.55), accent, true, [0, 0, -0.5]);
    }
    if (v === 'thonier') {
      // Grand mât de vigie, nid-de-pie, power-block, senne, canot de senne
      k.cyl(0.3, 0.2, 14, 0, roofY, z - wd * 0.6, white(), false);
      k.cyl(1.1, 1.1, 1.2, 0, roofY + 13, z - wd * 0.6, white(), true, undefined, 12);
      k.cyl(0.22, 0.18, k.h.L * 0.45, 0, roofY + 6, z - wd * 0.6, accent, true, [-1.15, 0, 0]);
      k.cyl(0.7, 0.7, 0.8, 0, roofY + 1.5, k.zAt(0.18), dark(), true, [0, 0, Math.PI / 2], 10);
      const pile = new THREE.SphereGeometry(B * 0.35, 12, 8).scale(1, 0.4, 1.4).translate(0, k.deck(0.2) + 0.3, k.zAt(0.2));
      k.put(pile, mat('netm2', () => new THREE.MeshStandardMaterial({ map: netTex(), color: 0x6a9a7a, roughness: 0.95 })), false);
      k.box(B * 0.45, 1.6, k.h.L * 0.14, 0, k.deck(0.03), k.zAt(0.02), paint(0xe0b020, 0.5, 0.2), true);
    }
  }

  // ------------------------------------------------------------ vedettes
  private speedboat(k: Kit, sp: ModernSpec, top: THREE.Material, accent: THREE.Material) {
    const { B, L } = k.h;
    const v = sp.variant;
    const ct = v === 'sauvetage' ? 0.5 : 0.48;
    const z = k.zAt(ct), y = k.deck(ct);
    const cw = B * (v === 'interception' ? 0.7 : 0.78), cd = L * (v === 'surveillance' || v === 'gardecote' ? 0.4 : 0.32);
    const ch = v === 'sauvetage' ? 2.6 : v === 'interception' ? 1.3 : 1.9;
    // Cabine : pare-brise incliné, toit
    k.slant(cw, ch, cd, cd * 0.62, 0, y, z, top, v === 'interception' ? 0.25 : 0.12);
    const ws = new THREE.PlaneGeometry(cw * 0.86, ch * 0.75);
    ws.rotateX(-0.75);
    ws.translate(0, y + ch * 0.55, z + cd * 0.4);
    k.put(ws, glass(), false);
    k.windows(cw * 0.94, ch * 0.4, 0, y + ch * 0.45, z - cd * 0.05, 'cotes', cd * 0.45);
    if (v === 'sauvetage') {
      k.box(cw * 0.7, 1.4, cd * 0.4, 0, y + ch, z - cd * 0.05, top);
      k.windows(cw * 0.66, 0.6, 0, y + ch + 0.5, z + cd * 0.15, 'avant');
      for (const s of [1, -1]) k.cyl(0.08, 0.08, L * 0.6, s * k.hw(0.5) * 0.98, k.deck(0.5) + 0.9, k.zAt(0.2), white(), true, [Math.PI / 2, 0, 0], 6);
      k.box(0.6, 0.4, 0.4, 0, y + ch + 1.4, z + cd * 0.1, this.lights, true);
    }
    // Arceau radar, gyrophares
    const ay = y + ch + (v === 'sauvetage' ? 1.4 : 0);
    if (v !== 'rapide') {
      for (const s of [1, -1]) k.box(0.18, 1.6, 0.18, s * cw * 0.42, ay, z - cd * 0.2, white(), true);
      k.box(cw * 0.9, 0.2, 0.3, 0, ay + 1.6, z - cd * 0.2, white(), true);
      this.body.add(k.radar(0, ay + 1.8, z - cd * 0.2, B * 0.3, this.radars));
      k.antenna(cw * 0.35, ay + 1.6, z - cd * 0.25, 3);
    }
    if (v === 'gardecote' || v === 'surveillance') {
      const lb = new THREE.BoxGeometry(cw * 0.5, 0.2, 0.25).translate(0, y + ch + 0.15, z + cd * 0.15);
      k.put(lb, mat('gyro', () => new THREE.MeshStandardMaterial({ color: 0x0a1a5a, emissive: 0x2a5aff, emissiveIntensity: 1.2 })), true);
    }
    if (v === 'gardecote') for (const s of [1, -1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(B * 0.9, B * 0.45), new THREE.MeshBasicMaterial({ map: tricolorTex(), transparent: true, depthWrite: false }));
      p.position.set(s * (k.hw(0.7) + 0.05), k.deck(0.7) * 0.55, k.zAt(0.7));
      p.rotation.y = s * Math.PI / 2;
      this.details.add(p);
    }
    // Moteurs hors-bord ou bloc moteur
    const n = v === 'interception' ? 4 : v === 'rapide' ? 2 : 0;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * B * 0.22;
      k.box(0.55, 1.3, 0.75, x, k.deck(0.02) - 0.3, k.zAt(0.0) - 0.4, black(), false);
      k.box(0.18, 1.4, 0.3, x, -k.h.draft * 0.9, k.zAt(0.0) - 0.5, dark(), true);
    }
    if (n === 0) k.propellers(2, B * 0.12);
    if (v === 'interception') k.cyl(0.08, 0.06, 1.8, 0, y + 0.3, k.zAt(0.82), dark(), true, [Math.PI / 2, 0, 0], 6);
    // Banquette et console arrière
    k.box(cw * 0.7, 0.5, L * 0.1, 0, k.deck(0.2), k.zAt(0.2), accent, true);
  }

  // ------------------------------------------------------------ patrouilleurs
  private patrol(k: Kit, sp: ModernSpec, top: THREE.Material, accent: THREE.Material) {
    const { B, L } = k.h;
    const v = sp.variant;
    const st = v === 'loire' ? 0.68 : 0.58;
    const z = k.zAt(st), y = k.deck(st);
    const sw = B * 0.74, sd = L * (v === 'aramis' ? 0.3 : 0.26);
    // Deux niveaux de superstructure, passerelle vitrée avec ailerons
    k.slant(sw, 2.8, sd, sd * 0.92, 0, y, z, undefined, 0.05);
    k.slant(sw * 0.9, 2.4, sd * 0.55, sd * 0.48, 0, y + 2.8, z + sd * 0.18, undefined, 0.06);
    k.windows(sw * 0.82, 0.9, 0, y + 3.9, z + sd * 0.18 + sd * 0.26, 'avant');
    for (const s of [1, -1]) k.box(B * 0.12, 0.2, 1.6, s * (sw / 2 + B * 0.05), y + 3.6, z + sd * 0.3, top, true);
    // Hublots du premier niveau
    for (let i = 0; i < 5; i++) for (const s of [1, -1]) k.cyl(0.18, 0.18, 0.08, s * (sw / 2 + 0.02), y + 1.5, z - sd * 0.35 + i * sd * 0.17, glass(), true, [0, 0, Math.PI / 2], 8);
    // Mât treillis + radars
    const my = y + 5.2;
    const mz = z + sd * 0.05;
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) k.cyl(0.08, 0.05, 6, dx, my, mz + dz, dark(), true, undefined, 5);
    k.box(1.8, 0.2, 1.8, 0, my + 3, mz, dark(), true);
    this.body.add(k.radar(0, my + 6, mz, B * 0.36, this.radars));
    k.cyl(0.9, 0.9, 1.4, 0, my + 3.2, mz - 0.4, white(), true, undefined, 12); // dôme satcom
    k.antenna(0.9, my + 3, mz, 4); k.antenna(-0.9, my + 3, mz, 3);
    // Cheminée
    k.slant(B * 0.3, 2.6, 3, 2.2, 0, y + 2.8, z - sd * 0.3, accent, 0.1);
    // Canon avant
    const gz = k.zAt(0.82), gy = k.deck(0.82);
    if (v === 'marine' || v === 'atlantique') k.turret(0, gy, gz, B * 0.22, B * 0.32, top);
    else { k.cyl(0.4, 0.4, 0.9, 0, gy, gz, dark(), false, undefined, 8); k.cyl(0.1, 0.08, 2, 0, gy + 0.8, gz + 0.2, dark(), false, [Math.PI / 2, 0, 0], 6); }
    // Semi-rigides sous bossoirs
    for (const s of [1, -1]) {
      k.rhib(s * (sw / 2 + B * 0.04), y + 1.2, z - sd * 0.55, Math.min(7, L * 0.12));
      k.cyl(0.08, 0.08, 2.4, s * (sw / 2), y + 2.8, z - sd * 0.55, dark(), true, [0, 0, s * 0.6], 5);
    }
    // Arrière : hélisurface / grue / plage
    if (v === 'marine' || v === 'atlantique') {
      const pad = new THREE.PlaneGeometry(B * 0.85, L * 0.24).rotateX(-Math.PI / 2).translate(0, k.deck(0.13) + 0.05, k.zAt(0.13));
      k.put(pad, mat('padm', () => new THREE.MeshStandardMaterial({ map: padTex(), roughness: 0.8 })), false);
      if (v === 'atlantique') k.box(sw * 0.8, 3.2, L * 0.1, 0, k.deck(0.27), k.zAt(0.27)); // hangar à drone
    }
    if (v === 'loire') {
      k.cyl(0.6, 0.6, 2, B * 0.25, k.deck(0.32), k.zAt(0.32), paint(0xf0c020, 0.5, 0.3), false);
      k.cyl(0.35, 0.25, L * 0.4, B * 0.25, k.deck(0.32) + 2, k.zAt(0.32), paint(0xf0c020, 0.5, 0.3), false, [-1.0, 0.4, 0]);
      for (let i = 0; i < 3; i++) k.box(2.2, 2.2, 5, -B * 0.15, k.deck(0.18), k.zAt(0.12 + i * 0.07), paint([0x1f4fa0, 0xb02020, 0x2a7a3a][i], 0.6, 0.3), true);
    }
    this.lanternPos.push(new THREE.Vector3(0, my + 3.4, mz));
  }

  // ------------------------------------------------------------ frégates
  private frigate(k: Kit, sp: ModernSpec, top: THREE.Material, accent: THREE.Material) {
    const { B, L } = k.h;
    const v = sp.variant;
    const gz = k.zAt(0.8), gy = k.deck(0.8);
    // Canon principal furtif + silos verticaux
    k.turret(0, gy, gz, B * (v === 'fda' ? 0.34 : 0.28), B * (v === 'fda' ? 0.6 : 0.45), top);
    const vls = new THREE.BoxGeometry(B * 0.5, 0.6, L * (v === 'fda' ? 0.11 : 0.08));
    vls.translate(0, k.deck(0.71) + 0.3, k.zAt(0.71));
    const vm = mat('vlsm', () => new THREE.MeshStandardMaterial({ map: vlsTex(), roughness: 0.7, metalness: 0.3 }));
    k.put(vls, vm, false);
    // Superstructure avant (passerelle) furtive
    const sz = k.zAt(0.6), sy = k.deck(0.6);
    const sw = B * 0.8;
    k.slant(sw, 4.2, L * 0.16, L * 0.12, 0, sy, sz, undefined, 0.12);
    k.slant(sw * 0.84, 3, L * 0.09, L * 0.065, 0, sy + 4.2, sz + L * 0.025, undefined, 0.12);
    const wy = sy + 5.6;
    const wsG = new THREE.PlaneGeometry(sw * 0.7, 1.1).rotateX(-0.35).translate(0, wy, sz + L * 0.025 + L * 0.036);
    k.put(wsG, glass(), false);
    // Mâts selon la classe
    const mz = sz - L * 0.01, my = sy + 7.2;
    if (v === 'fremm') {
      const mast = new THREE.ConeGeometry(B * 0.26, 14, 4).rotateY(Math.PI / 4).translate(0, my + 7, mz);
      k.put(mast, undefined);
      this.body.add(k.radar(0, my + 14, mz, B * 0.5, this.radars));
      k.box(B * 0.32, B * 0.32, 0.4, 0, my + 9, mz + B * 0.12, dark(), true);
    } else if (v === 'horizon') {
      k.cyl(B * 0.08, B * 0.06, 12, 0, my, mz, undefined);
      k.cyl(B * 0.2, B * 0.2, 2.2, 0, my + 12, mz, white(), false, undefined, 16);
      const dome = new THREE.SphereGeometry(B * 0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, my + 14.2, mz);
      k.put(dome, white(), false);
      // Mât arrière avec radar tournant
      k.cyl(B * 0.07, B * 0.05, 9, 0, k.deck(0.38) + 5, k.zAt(0.38), undefined);
      this.body.add(k.radar(0, k.deck(0.38) + 14, k.zAt(0.38), B * 0.55, this.radars));
    } else if (v === 'lafayette') {
      for (const [t, hh] of [[0.58, 11], [0.4, 8]] as const) {
        const m = new THREE.ConeGeometry(B * 0.22, hh, 4).rotateY(Math.PI / 4).translate(0, k.deck(t) + 4 + hh / 2, k.zAt(t));
        k.put(m, undefined);
        this.body.add(k.radar(0, k.deck(t) + 4 + hh, k.zAt(t), B * 0.4, this.radars));
      }
    } else if (v === 'fda' || v === 'fdi') {
      // Tour-mât intégrée avec panneaux radar plans sur ses faces
      const th = v === 'fdi' ? 12 : 9;
      k.slant(B * 0.42, th, B * 0.45, B * 0.32, 0, my - 1, mz, undefined, 0.2);
      const pm = mat('panel', () => new THREE.MeshStandardMaterial({ color: 0x2e3640, roughness: 0.4, metalness: 0.6 }));
      for (const [dx, dz, ry] of [[0, B * 0.2, 0], [0, -B * 0.2, Math.PI], [B * 0.18, 0, Math.PI / 2], [-B * 0.18, 0, -Math.PI / 2]] as const) {
        const p = new THREE.BoxGeometry(B * 0.26, B * 0.26, 0.25).rotateY(ry).translate(dx, my + th * 0.62, mz + dz);
        k.put(p, pm, false);
      }
      this.body.add(k.radar(0, my + th - 0.5, mz, B * 0.3, this.radars));
      k.antenna(0, my + th - 0.4, mz, 4);
    }
    // Cheminée(s)
    const funnels = v === 'horizon' ? [0.5, 0.33] : [0.45];
    for (const t of funnels) k.slant(B * 0.4, 4.5, L * 0.07, L * 0.05, 0, k.deck(t) + 3, k.zAt(t), accent, 0.15);
    k.slant(sw * 0.9, 3, L * 0.22, L * 0.2, 0, k.deck(0.42), k.zAt(0.42), undefined, 0.1);
    // Lanceurs antinavires (2 × 4 tubes inclinés)
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
      k.cyl(0.32, 0.32, 5.5, s * (B * 0.12 + i * 0.7), k.deck(0.36) + 3.2, k.zAt(0.36), white(), true, [Math.PI / 2 - 0.25, 0, 0], 8);
    }
    // Défense rapprochée
    k.cyl(0.6, 0.5, 1.2, 0, k.deck(0.3) + 3.4, k.zAt(0.29), white(), true, undefined, 10);
    // Embarcations et bossoirs
    for (const s of [1, -1]) k.rhib(s * (sw / 2 + 0.6), k.deck(0.47) + 2.8, k.zAt(0.47), 8);
    // Hangar et pont d'envol
    const hz = k.zAt(0.24);
    k.slant(sw, 5.5, L * 0.13, L * 0.12, 0, k.deck(0.24), hz, undefined, 0.1);
    k.box(sw * 0.62, 4.6, 0.12, 0, k.deck(0.24), hz - L * 0.065, dark(), false);
    const pad = new THREE.PlaneGeometry(B * 0.9, L * 0.17).rotateX(-Math.PI / 2).translate(0, k.deck(0.1) + 0.05, k.zAt(0.1));
    k.put(pad, mat('padm', () => new THREE.MeshStandardMaterial({ map: padTex(), roughness: 0.8 })), false);
    // Hélicoptère posé (FREMM et frégate polyvalente)
    if (v === 'fremm' || v === 'fdi') {
      const hy = k.deck(0.1);
      const fus = new THREE.CapsuleGeometry(1.3, 6, 4, 10).rotateX(Math.PI / 2).translate(0, hy + 1.6, k.zAt(0.11));
      k.put(fus, paint(0x5a646e, 0.6, 0.3), true);
      k.cyl(0.35, 0.2, 6, 0, hy + 2, k.zAt(0.11) - 3, paint(0x5a646e, 0.6, 0.3), true, [-Math.PI / 2, 0, 0], 6);
      const rotor = new THREE.Group();
      rotor.position.set(0, hy + 3.2, k.zAt(0.11));
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 7.5), dark()); b.rotation.y = (i / 4) * Math.PI; rotor.add(b); }
      this.details.add(rotor);
      this.rotor = rotor;
    }
    this.lanternPos.push(new THREE.Vector3(0, my + 3, mz));
  }

  /** Masque les petits détails au loin (niveau de détail). */
  setDetail(distance: number) {
    this.details.visible = distance < 650;
  }

  update(t: number, dt: number, _sail: number, _wr: number, _ws: number, damage: number, _sd: number, night: number) {
    for (const r of this.radars) r.rotation.y += dt * 2.2;
    if (this.rotor) this.rotor.rotation.y = 0.3;
    this.flagU.uTime.value = t;
    this.hullMat.color.setScalar(1 - damage * 0.55);
    this.lights.emissiveIntensity = 0.3 + night * 3.5;
    (glass() as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + night * 1.1;
  }

  dispose() {
    this.body.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    for (const m of this.own) m.dispose();
  }
}
