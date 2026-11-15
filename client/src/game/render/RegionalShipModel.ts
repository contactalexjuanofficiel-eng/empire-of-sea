// Navires des régions lointaines, avec leur silhouette propre : jonque à voiles lattées (Mers d'Asie),
// galère à rames et voiles latines (Méditerranée), felouque (Levant), drakkar des glaces (boss des Mers du Nord).
// Géométrie générée par le code, comme les autres navires : coque partagée avec le générateur moderne.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHIP_CLASSES, type ShipDef } from '../../../../shared/ships';
import { buildSteelHull, deckAt, hullHalfWidth, type HullShape } from './ModernShipModel';
import { flagTexture } from './textures';

type Kind = NonNullable<ShipDef['regional']>;

const SHAPES: Record<Kind, (B: number) => Omit<HullShape, 'L' | 'B'>> = {
  jonque: (B) => ({ draft: B * 0.3, F: B * 0.36, transom: 0.92, vpow: 0.55, flare: 0.12, rake: 0.04, sheer: 0.5 }),
  galere: (B) => ({ draft: B * 0.24, F: B * 0.3, transom: 0.55, vpow: 0.7, flare: 0.08, rake: 0.22, sheer: 0.35 }),
  felouque: (B) => ({ draft: B * 0.28, F: B * 0.32, transom: 0.45, vpow: 0.7, flare: 0.08, rake: 0.16, sheer: 0.6 }),
  drakkar: (B) => ({ draft: B * 0.26, F: B * 0.3, transom: 0.12, vpow: 0.6, flare: 0.16, rake: 0.08, sheer: 0.7 }),
};

/** Texture de voile : lattes (jonque), rayures (drakkar) ou toile unie. */
function sailTexture(kind: Kind, color: number, accent: number) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d')!;
  const col = new THREE.Color(color), acc = new THREE.Color(accent);
  g.fillStyle = `#${col.getHexString()}`;
  g.fillRect(0, 0, 128, 128);
  if (kind === 'jonque') {
    g.fillStyle = 'rgba(30,18,10,0.85)';
    for (let i = 1; i < 7; i++) g.fillRect(0, i * 18 - 2, 128, 4);
  } else if (kind === 'drakkar') {
    g.fillStyle = `#${acc.getHexString()}`;
    for (let i = 0; i < 8; i += 2) g.fillRect(i * 16, 0, 16, 128);
  } else {
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 128; i += 16) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class RegionalShipModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly dims: { L: number; B: number; F: number; draft: number; decks: number; masts: [] };
  readonly firePoints: THREE.Vector3[] = [];
  private own: (THREE.Material | THREE.Texture)[] = [];
  private hullMat: THREE.MeshStandardMaterial;
  private baseHull = new THREE.Color();
  private oars: THREE.Group[] = [];
  private sails: THREE.Mesh[] = [];
  private glow: THREE.PointLight | null = null;

  constructor(readonly def: ShipDef) {
    const kind = def.regional!;
    const cls = SHIP_CLASSES[def.cls];
    const L = def.size?.L ?? cls.length, B = def.size?.B ?? cls.beam;
    const h: HullShape = { L, B, ...SHAPES[kind](B) };
    this.dims = { L, B, F: h.F, draft: h.draft, decks: 0, masts: [] };
    const look = def.look;
    const zAt = (t: number) => -L / 2 + t * L;
    const hw = (t: number) => (B / 2) * hullHalfWidth(h, t) * (1 + h.flare * 0.9);
    const deck = (t: number) => deckAt(h, t);

    // Coque (bois) et pont
    this.hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, emissive: look.glow ?? 0x000000, emissiveIntensity: look.glow ? 0.25 : 0 });
    this.baseHull.set(0xffffff);
    this.own.push(this.hullMat);
    const hull = new THREE.Mesh(buildSteelHull(h, look.hull, look.stripe), this.hullMat);
    hull.castShadow = true;
    this.body.add(hull);
    const dp: number[] = [], di: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = 0.02 + (i / 24) * 0.95, w = hw(t) * 0.94;
      dp.push(-w, deck(t), zAt(t), w, deck(t), zAt(t));
      if (i < 24) { const a = i * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dg.setIndex(di);
    dg.computeVertexNormals();
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9, side: THREE.DoubleSide });
    this.own.push(deckMat);
    this.body.add(new THREE.Mesh(dg, deckMat));

    const wood: THREE.BufferGeometry[] = [];
    const trim: THREE.BufferGeometry[] = [];
    const box = (list: THREE.BufferGeometry[], w: number, hh: number, d: number, x: number, y: number, z: number) => list.push(new THREE.BoxGeometry(w, hh, d).translate(x, y + hh / 2, z));
    const pole = (list: THREE.BufferGeometry[], r: number, a: THREE.Vector3, b: THREE.Vector3) => {
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(r * 0.8, r, len, 6);
      g.translate(0, len / 2, 0);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate(a.x, a.y, a.z);
      list.push(g);
    };
    const sailMat = new THREE.MeshStandardMaterial({ map: sailTexture(kind, look.sail || 0xe8dcc0, look.trim), roughness: 0.9, side: THREE.DoubleSide, emissive: look.glow ?? 0, emissiveIntensity: look.glow ? 0.18 : 0 });
    this.own.push(sailMat, sailMat.map!);
    const addSail = (geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw: number) => {
      const m = new THREE.Mesh(geo, sailMat);
      m.position.set(x, y, z);
      m.rotation.y = yaw;
      m.castShadow = true;
      this.sails.push(m);
      this.body.add(m);
    };

    if (kind === 'jonque') {
      // Château arrière haut et carré, plateforme d'avant, trois mâts à voiles lattées en éventail.
      box(wood, B * 0.82, 3.2, L * 0.16, 0, deck(0.06), zAt(0.1));
      box(trim, B * 0.88, 0.4, L * 0.17, 0, deck(0.06) + 3.2, zAt(0.1));
      box(wood, B * 0.6, 1.2, L * 0.08, 0, deck(0.9), zAt(0.9));
      const masts: [number, number][] = [[0.78, 0.55], [0.52, 0.72], [0.25, 0.48]];
      for (const [t, hr] of masts) {
        const y0 = deck(t), H = L * hr;
        pole(wood, 0.35, new THREE.Vector3(0, y0, zAt(t)), new THREE.Vector3(0, y0 + H, zAt(t)));
        const w = H * 0.62;
        const sh = new THREE.Shape();
        sh.moveTo(-w * 0.15, 0); sh.lineTo(w * 0.85, 0); sh.lineTo(w * 0.7, H * 0.85); sh.lineTo(-w * 0.05, H * 0.92); sh.closePath();
        const g = new THREE.ShapeGeometry(sh);
        // UV de 0 à 1 pour la texture à lattes
        const uv = g.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w * 0.15) / w, uv.getY(i) / (H * 0.92));
        addSail(g, 0, y0 + H * 0.08, zAt(t), Math.PI / 2 - 0.9);
      }
      for (const t of [0.15, 0.5, 0.85]) this.firePoints.push(new THREE.Vector3(0, deck(t) + 1, zAt(t)));
    } else if (kind === 'galere' || kind === 'felouque') {
      // Voiles latines : grande vergue inclinée et voile triangulaire.
      const masts: [number, number][] = kind === 'galere' ? [[0.62, 0.42], [0.3, 0.32]] : [[0.62, 0.5], [0.3, 0.36]];
      for (const [t, hr] of masts) {
        const y0 = deck(t), H = L * hr;
        pole(wood, 0.28, new THREE.Vector3(0, y0, zAt(t)), new THREE.Vector3(0, y0 + H, zAt(t)));
        const yardA = new THREE.Vector3(0, y0 + H * 0.25, zAt(t) + H * 0.55);
        const yardB = new THREE.Vector3(0, y0 + H * 1.05, zAt(t) - H * 0.45);
        pole(wood, 0.16, yardA, yardB);
        const tri = new THREE.BufferGeometry();
        const foot = new THREE.Vector3(0, y0 + 1.2, zAt(t) - H * 0.35);
        tri.setAttribute('position', new THREE.Float32BufferAttribute([yardA.x, yardA.y, yardA.z - zAt(t), yardB.x, yardB.y, yardB.z - zAt(t), foot.x, foot.y, foot.z - zAt(t)].map((v, i) => (i % 3 === 1 ? v - y0 : v)), 3));
        tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 0, 1], 2));
        tri.computeVertexNormals();
        addSail(tri, 0, y0, zAt(t), 0.5);
      }
      if (kind === 'galere') {
        // Éperon, tente de poupe, et deux bancs de rames animées.
        const ram = new THREE.ConeGeometry(0.6, L * 0.12, 8).rotateX(Math.PI / 2).translate(0, h.F * 0.35, L / 2 + L * 0.05);
        trim.push(ram);
        box(trim, B * 0.7, 1.8, L * 0.1, 0, deck(0.05), zAt(0.07));
        const oarMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
        this.own.push(oarMat);
        for (const side of [1, -1]) {
          const grp = new THREE.Group();
          const geos: THREE.BufferGeometry[] = [];
          const n = 12;
          for (let i = 0; i < n; i++) {
            const t = 0.2 + (i / (n - 1)) * 0.6;
            const z = zAt(t), x = side * hw(t);
            const g = new THREE.CylinderGeometry(0.1, 0.12, B * 1.1, 5);
            g.translate(0, -B * 0.55, 0);
            g.rotateZ(side * (Math.PI / 2 - 0.45));
            g.translate(x, deck(t) - 0.2, z);
            geos.push(g);
          }
          const mesh = new THREE.Mesh(mergeGeometries(geos)!, oarMat);
          grp.add(mesh);
          grp.userData.side = side;
          this.oars.push(grp);
          this.body.add(grp);
        }
      }
      for (const t of [0.2, 0.5, 0.8]) this.firePoints.push(new THREE.Vector3(0, deck(t) + 1, zAt(t)));
    } else {
      // Drakkar : étrave et étambot recourbés en volute, boucliers ronds sur le plat-bord, voile carrée rayée.
      const post = (front: boolean) => {
        const s = front ? 1 : -1;
        const pts = [new THREE.Vector3(0, h.F * 0.9, s * L * 0.46), new THREE.Vector3(0, h.F * 2.2, s * L * 0.53), new THREE.Vector3(0, h.F * 3.4, s * L * 0.52), new THREE.Vector3(0, h.F * 3.9, s * L * 0.47), new THREE.Vector3(0, h.F * 3.5, s * L * 0.44)];
        trim.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.45, 6, false));
      };
      post(true); post(false);
      const shieldMat = new THREE.MeshStandardMaterial({ color: look.trim, roughness: 0.6, metalness: 0.3, emissive: look.glow ?? 0, emissiveIntensity: look.glow ? 0.35 : 0 });
      this.own.push(shieldMat);
      const shields: THREE.BufferGeometry[] = [];
      for (const side of [1, -1]) for (let i = 0; i < 14; i++) {
        const t = 0.18 + (i / 13) * 0.64;
        const g = new THREE.CylinderGeometry(B * 0.09, B * 0.09, 0.15, 12).rotateZ(Math.PI / 2).translate(side * (hw(t) + 0.1), deck(t) + 0.55, zAt(t));
        shields.push(g);
      }
      this.body.add(new THREE.Mesh(mergeGeometries(shields)!, shieldMat));
      const y0 = deck(0.5), H = L * 0.5;
      pole(wood, 0.45, new THREE.Vector3(0, y0, 0), new THREE.Vector3(0, y0 + H, 0));
      pole(wood, 0.25, new THREE.Vector3(-B * 0.95, y0 + H * 0.9, 0), new THREE.Vector3(B * 0.95, y0 + H * 0.9, 0));
      const sail = new THREE.PlaneGeometry(B * 1.85, H * 0.7, 8, 4);
      addSail(sail, 0, y0 + H * 0.55, 0.6, 0);
      for (const t of [0.25, 0.5, 0.75]) this.firePoints.push(new THREE.Vector3(0, deck(t) + 1, zAt(t)));
      if (look.glow) {
        this.glow = new THREE.PointLight(look.glow, 600, L * 1.4, 1.8);
        this.glow.position.set(0, H * 0.6, 0);
        this.body.add(this.glow);
      }
    }

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: look.trim, roughness: 0.5, metalness: 0.4, emissive: look.glow ?? 0, emissiveIntensity: look.glow ? 0.3 : 0 });
    this.own.push(woodMat, trimMat);
    if (wood.length) this.body.add(new THREE.Mesh(mergeGeometries(wood.map((g) => g.toNonIndexed()))!, woodMat));
    if (trim.length) this.body.add(new THREE.Mesh(mergeGeometries(trim.map((g) => g.toNonIndexed()))!, trimMat));

    // Pavillon en tête du grand mât (pirates, barbaresques…)
    if (look.flag !== 'aucun') {
      const fm = new THREE.MeshStandardMaterial({ map: flagTexture(look.flag), side: THREE.DoubleSide });
      this.own.push(fm);
      const fs = Math.max(1.4, B * 0.25);
      const top = this.body.children.reduce((m, o) => Math.max(m, new THREE.Box3().setFromObject(o).max.y), 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(fs * 1.5, fs).translate(-fs * 0.75, 0, 0), fm);
      flag.position.set(0, top + fs * 0.4, zAt(0.52));
      flag.rotation.y = Math.PI / 2;
      this.body.add(flag);
    }
    this.root.add(this.body);
  }

  update(t: number, _dt: number, sail: number, _windRel: number, windStrength: number, damage: number, _sd: number, _night: number) {
    // Rames : coups réguliers quand le navire avance.
    for (const g of this.oars) g.rotation.y = g.userData.side * Math.sin(t * 2.4) * 0.28 * (sail > 0 ? 1 : 0.2);
    // Voiles qui battent doucement au vent.
    this.sails.forEach((s, i) => { s.scale.x = 1 + Math.sin(t * 1.3 + i) * 0.03 * windStrength; });
    this.hullMat.color.copy(this.baseHull).multiplyScalar(1 - Math.min(0.6, damage * 0.6));
    if (this.glow) this.glow.intensity = 500 + Math.sin(t * 2) * 150;
  }

  dispose() {
    this.body.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    for (const m of this.own) m.dispose();
  }
}
