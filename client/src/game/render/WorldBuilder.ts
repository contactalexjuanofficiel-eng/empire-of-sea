// Construction visuelle d'une zone : îles en relief, végétation selon le climat, villes portuaires, quais,
// phares, forts (français et repaires pirates), épaves. Produit aussi la carte des fonds pour l'océan
// et l'image de la mini-carte.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from '../../../../shared/math';
import { buildWorld, coastRadius, islandHeight, terrainHeight, type Island, type ZoneWorld } from '../../../../shared/world';
import type { Vegetation, ZoneDef } from '../../../../shared/zones';
import { SHIP_BY_ID } from '../../../../shared/ships';
import { ShipModel } from './ShipModel';
import { flagTexture, grainTexture } from './textures';

const PALETTES: Record<Vegetation, { sand: number; low: number; high: number; rock: number; cliff: number; roof: number; wall: number }> = {
  tempere: { sand: 0xc4b58a, low: 0x4c6a33, high: 0x3b5128, rock: 0x6e6b63, cliff: 0x55524c, roof: 0x3d4552, wall: 0xc9c1ad },
  atlantique: { sand: 0xd2c49a, low: 0x5b783b, high: 0x45602f, rock: 0x77736a, cliff: 0x5f5b54, roof: 0x434a57, wall: 0xe0d8c4 },
  mediterraneen: { sand: 0xdccca2, low: 0x7a7c45, high: 0x5d6a37, rock: 0xb8a988, cliff: 0x9e8f72, roof: 0xb4552f, wall: 0xe8dcc0 },
  tropical: { sand: 0xebe0bb, low: 0x3e8a32, high: 0x2b6a26, rock: 0x5f574b, cliff: 0x4d463c, roof: 0x9a4a2a, wall: 0xf0e6cf },
  brumeux: { sand: 0x7f7a6c, low: 0x3d4838, high: 0x2f382d, rock: 0x3d3c3a, cliff: 0x2e2d2c, roof: 0x2c2f33, wall: 0x8d887c },
};

export interface ZoneVisual {
  group: THREE.Group;
  depthTex: THREE.DataTexture;
  minimap: HTMLCanvasElement;
  world: ZoneWorld;
  lighthouses: { beam: THREE.Mesh; lamp: THREE.MeshStandardMaterial }[];
  windows: THREE.MeshStandardMaterial[];
  labels: { text: string; x: number; y: number; z: number; kind: 'port' | 'ile' | 'epave' | 'fort' }[];
  dispose(): void;
}

function colorGeo(g: THREE.BufferGeometry, c: number) {
  const col = new THREE.Color(c);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g.index ? g.toNonIndexed() : g;
}

function treeGeometry(kind: Vegetation): THREE.BufferGeometry[] {
  if (kind === 'tropical') {
    const parts: THREE.BufferGeometry[] = [];
    let x = 0, y = 0;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.CylinderGeometry(0.22 - i * 0.02, 0.28 - i * 0.02, 2.4, 6);
      seg.translate(x, y + 1.2, 0);
      parts.push(colorGeo(seg, 0x7a6248));
      x += 0.25 + i * 0.08;
      y += 2.3;
    }
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.ConeGeometry(0.7, 5.2, 4);
      leaf.scale(1, 1, 0.25);
      leaf.translate(0, 2.4, 0);
      leaf.rotateZ(1.25 + Math.random() * 0.3);
      leaf.rotateY((i / 7) * Math.PI * 2);
      leaf.translate(x, y, 0);
      parts.push(colorGeo(leaf, i % 2 ? 0x3f7d2a : 0x4f9133));
    }
    return [mergeGeometries(parts)!];
  }
  if (kind === 'mediterraneen') {
    const cypress = mergeGeometries([colorGeo(new THREE.CylinderGeometry(0.2, 0.25, 1.5, 5).translate(0, 0.75, 0), 0x5a4632), colorGeo(new THREE.ConeGeometry(1.1, 9, 7).translate(0, 5.5, 0), 0x2f4a26)])!;
    const olive = mergeGeometries([colorGeo(new THREE.CylinderGeometry(0.25, 0.4, 2.2, 5).translate(0, 1.1, 0), 0x6a5a48), colorGeo(new THREE.IcosahedronGeometry(2.4, 0).scale(1.2, 0.8, 1.2).translate(0, 3.2, 0), 0x6b7442)])!;
    return [cypress, olive];
  }
  if (kind === 'brumeux') {
    const parts: THREE.BufferGeometry[] = [colorGeo(new THREE.CylinderGeometry(0.15, 0.35, 7, 5).translate(0, 3.5, 0), 0x3a352f)];
    for (let i = 0; i < 4; i++) {
      const b = new THREE.CylinderGeometry(0.05, 0.12, 3, 4).translate(0, 1.5, 0);
      b.rotateZ(0.9);
      b.rotateY(i * 1.7);
      b.translate(0, 3 + i * 0.9, 0);
      parts.push(colorGeo(b, 0x3a352f));
    }
    return [mergeGeometries(parts)!];
  }
  // Pins maritimes et chênes
  const pine = mergeGeometries([
    colorGeo(new THREE.CylinderGeometry(0.2, 0.3, 3, 5).translate(0, 1.5, 0), 0x5a4632),
    colorGeo(new THREE.ConeGeometry(2.2, 4.5, 7).translate(0, 4.2, 0), 0x2e4a2a),
    colorGeo(new THREE.ConeGeometry(1.6, 3.6, 7).translate(0, 6.2, 0), 0x355431),
  ])!;
  const oak = mergeGeometries([
    colorGeo(new THREE.CylinderGeometry(0.3, 0.45, 2.6, 5).translate(0, 1.3, 0), 0x5a4632),
    colorGeo(new THREE.IcosahedronGeometry(2.8, 0).translate(0, 4.2, 0), 0x40602e),
  ])!;
  return [pine, oak];
}

function buildIsland(isl: Island, pal: (typeof PALETTES)[Vegetation], veg: Vegetation) {
  const R = Math.round(Math.min(60, 18 + isl.r / 7));
  const S = Math.round(Math.min(120, 32 + isl.r / 3));
  const maxR = isl.r * 1.35;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  const cs = { sand: new THREE.Color(pal.sand), low: new THREE.Color(pal.low), high: new THREE.Color(pal.high), rock: new THREE.Color(pal.rock), cliff: new THREE.Color(pal.cliff), wet: new THREE.Color(pal.sand).multiplyScalar(0.7) };
  const R0 = rng(isl.seed);
  pos.push(isl.x, islandHeight(isl, isl.x, isl.z), isl.z);
  c.copy(cs.rock); col.push(c.r, c.g, c.b);
  for (let i = 1; i <= R; i++) {
    const rr = Math.pow(i / R, 1.1) * maxR;
    for (let j = 0; j < S; j++) {
      const a = (j / S) * Math.PI * 2;
      const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
      const h = Math.max(-12, islandHeight(isl, x, z));
      pos.push(x, h, z);
      const e = 2.5;
      const hx = islandHeight(isl, x + e, z) - islandHeight(isl, x - e, z);
      const hz = islandHeight(isl, x, z + e) - islandHeight(isl, x, z - e);
      const slope = Math.hypot(hx, hz) / (2 * e);
      const n = R0();
      if (h < 0.6) c.copy(cs.wet).lerp(cs.sand, Math.max(0, h + 1.5) / 2.1);
      else if (h < 3.2) c.copy(cs.sand).lerp(cs.low, Math.max(0, (h - 2) / 1.2));
      else {
        c.copy(cs.low).lerp(cs.high, Math.min(1, h / Math.max(20, isl.height * 0.8)) * 0.8 + n * 0.2);
        if (h > isl.height * 0.7 && veg !== 'tropical') c.lerp(cs.rock, 0.5);
      }
      if (slope > 0.75 && h > 1.5) c.lerp(cs.cliff, Math.min(1, (slope - 0.75) * 1.6));
      c.multiplyScalar(0.9 + n * 0.18);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < S; j++) idx.push(0, 1 + ((j + 1) % S), 1 + j);
  for (let i = 1; i < R; i++) {
    for (let j = 0; j < S; j++) {
      const a = 1 + (i - 1) * S + j, b = 1 + (i - 1) * S + ((j + 1) % S);
      const c2 = a + S, d = b + S;
      idx.push(a, b, c2, b, d, c2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] / 30, pos[i + 2] / 30);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildZoneVisual(zone: ZoneDef): ZoneVisual {
  const world = buildWorld(zone);
  const group = new THREE.Group();
  const pal = PALETTES[zone.vegetation];
  const R = rng(zone.seed + 99);
  const disposables: { dispose(): void }[] = [];
  const labels: ZoneVisual['labels'] = [];

  // --- Îles
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: grainTexture() });
  disposables.push(terrainMat);
  const islandGeos: THREE.BufferGeometry[] = [];
  for (const isl of world.islands) islandGeos.push(buildIsland(isl, pal, zone.vegetation).toNonIndexed());
  const islandsGeo = mergeGeometries(islandGeos)!;
  islandsGeo.computeVertexNormals();
  const islands = new THREE.Mesh(islandsGeo, terrainMat);
  islands.receiveShadow = true;
  islands.castShadow = false;
  group.add(islands);
  disposables.push(islandsGeo);

  // --- Végétation (instanciée) et rochers
  const treeKinds = treeGeometry(zone.vegetation);
  const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  disposables.push(treeMat);
  const treeLists: THREE.Matrix4[][] = treeKinds.map(() => []);
  const rockList: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const isl of world.islands) {
    const count = Math.round((isl.r * isl.r) / 450) * (zone.vegetation === 'brumeux' ? 0.4 : 1);
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * isl.r * 1.05;
      const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
      const h = islandHeight(isl, x, z);
      if (h < 3.5 || h > isl.height * 0.85) continue;
      if (isl.port) {
        const dock = world.docks[isl.port.id];
        const toDock = Math.atan2(dock.z - isl.z, dock.x - isl.x);
        let dA = Math.abs(Math.atan2(Math.sin(a - toDock), Math.cos(a - toDock)));
        if (dA < 1.0 && rr > isl.r * 0.25) continue; // pas d'arbres dans la ville
      }
      const k = Math.floor(R() * treeKinds.length);
      const sc = 0.8 + R() * 0.9;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.28);
      treeLists[k].push(new THREE.Matrix4().compose(p.set(x, h - 0.3, z), q, s.set(sc, sc * (0.85 + R() * 0.4), sc)));
    }
    const rocks = Math.round(isl.r / 9);
    for (let i = 0; i < rocks; i++) {
      const a = R() * Math.PI * 2;
      const rr = coastRadius(isl, a) * (0.92 + R() * 0.16);
      const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
      const sc = 1.5 + R() * 5;
      q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3));
      rockList.push(new THREE.Matrix4().compose(p.set(x, islandHeight(isl, x, z) - sc * 0.3, z), q, s.set(sc, sc * 0.7, sc)));
    }
  }
  treeKinds.forEach((g, k) => {
    if (!treeLists[k].length) return;
    const im = new THREE.InstancedMesh(g, treeMat, treeLists[k].length);
    treeLists[k].forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = false;
    im.receiveShadow = true;
    group.add(im);
    disposables.push(g);
  });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: pal.rock, roughness: 1, flatShading: true }), Math.max(1, rockList.length));
  rockList.forEach((m, i) => rockMesh.setMatrixAt(i, m));
  rockMesh.count = rockList.length;
  rockMesh.castShadow = false;
  group.add(rockMesh);

  // --- Villes portuaires
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
  const windowsMat = new THREE.MeshStandardMaterial({ color: 0x1a140e, emissive: 0xffa040, emissiveIntensity: 0 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8c877c, roughness: 0.95, map: grainTexture() });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.9 });
  const lighthouses: ZoneVisual['lighthouses'] = [];
  const walls: THREE.Matrix4[] = [], wallCols: THREE.Color[] = [], roofs: THREE.Matrix4[] = [], roofCols: THREE.Color[] = [], wins: THREE.Matrix4[] = [];
  const stones: THREE.BufferGeometry[] = [], woods: THREE.BufferGeometry[] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.rotateY(rotY);
    g.translate(x, y, z);
    return g;
  };

  for (const isl of world.islands) {
    if (!isl.port) continue;
    const dock = world.docks[isl.port.id];
    const dir = Math.atan2(dock.x - isl.x, dock.z - isl.z); // cap vers le quai
    labels.push({ text: isl.port.name, x: isl.x, y: 60, z: isl.z, kind: 'port' });
    // Maisons sur une terrasse face au port
    const RR = rng(isl.seed);
    for (let i = 0; i < 90; i++) {
      const a = dir + (RR() - 0.5) * 1.7;
      const rr = isl.r * (0.25 + RR() * 0.62);
      const x = isl.x + Math.sin(a) * rr, z = isl.z + Math.cos(a) * rr;
      const h = islandHeight(isl, x, z);
      if (h < 2.5 || h > 30) continue;
      const w = 6 + RR() * 7, d = 6 + RR() * 5, hh = 6 + RR() * 9;
      const rot = a + (RR() < 0.5 ? 0 : Math.PI / 2);
      walls.push(new THREE.Matrix4().compose(p.set(x, h + hh / 2 - 1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), s.set(w, hh, d)));
      wallCols.push(new THREE.Color(pal.wall).multiplyScalar(0.85 + RR() * 0.2));
      roofs.push(new THREE.Matrix4().compose(p.set(x, h + hh - 1, z), q, s.set(w * 1.08, 3.5 + RR() * 2, d * 1.08)));
      roofCols.push(new THREE.Color(pal.roof).multiplyScalar(0.8 + RR() * 0.3));
      if (RR() < 0.7) wins.push(new THREE.Matrix4().compose(p.set(x, h + hh * 0.55, z), q, s.set(w * 1.01, 1.2, d * 1.01)));
    }
    // Église et clocher
    const ca = dir + 0.35, cr = isl.r * 0.45;
    const cx = isl.x + Math.sin(ca) * cr, cz = isl.z + Math.cos(ca) * cr, ch = islandHeight(isl, cx, cz);
    stones.push(box(10, 16, 24, cx, ch + 7, cz, ca), box(7, 30, 7, cx, ch + 14, cz + 0, ca));
    const spire = new THREE.ConeGeometry(5, 16, 4);
    spire.rotateY(Math.PI / 4 + ca);
    spire.translate(cx, ch + 37, cz);
    stones.push(spire);
    // Quai de pierre et jetées en bois vers le point d'accostage
    const coast = coastRadius(isl, Math.atan2(dock.z - isl.z, dock.x - isl.x));
    for (let k = -4; k <= 4; k++) {
      const a = dir + k * 0.07;
      const x = isl.x + Math.sin(a) * coast * 0.98, z = isl.z + Math.cos(a) * coast * 0.98;
      stones.push(box(coast * 0.075, 5, 6, x, 0.5, z, a));
    }
    for (let k = -1; k <= 1; k++) {
      const a = dir + k * 0.18;
      const sx = isl.x + Math.sin(a) * coast * 0.95, sz = isl.z + Math.cos(a) * coast * 0.95;
      const len = 70;
      woods.push(box(5, 1, len, sx + Math.sin(a) * len / 2, 2.2, sz + Math.cos(a) * len / 2, a));
      for (let j = 0; j < 7; j++) woods.push(box(0.8, 6, 0.8, sx + Math.sin(a) * j * 11 + Math.cos(a) * 2.2, -1, sz + Math.cos(a) * j * 11 - Math.sin(a) * 2.2, a));
    }
    // Phare
    const la = dir - 0.95;
    const lr = coastRadius(isl, Math.atan2(Math.cos(la), Math.sin(la))) * 0.9;
    const lx = isl.x + Math.sin(la) * lr, lz = isl.z + Math.cos(la) * lr, lh = Math.max(2, islandHeight(isl, lx, lz));
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.6, 34, 14), new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.7 }));
    tower.position.set(lx, lh + 17, lz);
    const lamp = new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffd27a, emissiveIntensity: 0.5 });
    const lampMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4, 12), lamp);
    lampMesh.position.set(lx, lh + 36, lz);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8a2b22 }));
    cap.position.set(lx, lh + 40, lz);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(16, 260, 16, 1, true).translate(0, -130, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.set(lx, lh + 36, lz);
    group.add(tower, lampMesh, cap, beam);
    lighthouses.push({ beam, lamp });
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.CylinderGeometry(0.0001, 0.72, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
  roofGeo.scale(1, 1, 1);
  if (walls.length) {
    const wm = new THREE.InstancedMesh(unitBox, wallMat, walls.length);
    walls.forEach((m, i) => { wm.setMatrixAt(i, m); wm.setColorAt(i, wallCols[i]); });
    wm.receiveShadow = true;
    const rm = new THREE.InstancedMesh(roofGeo, roofMat, roofs.length);
    roofs.forEach((m, i) => { rm.setMatrixAt(i, m); rm.setColorAt(i, roofCols[i]); });
    const win = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), windowsMat, Math.max(1, wins.length));
    wins.forEach((m, i) => win.setMatrixAt(i, m));
    win.count = wins.length;
    win.scale.set(1, 1, 1);
    group.add(wm, rm, win);
  }

  // --- Forts
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.7, roughness: 0.45 });
  for (const f of world.forts) {
    const isl = world.islands.find((i) => i.id === f.islandId)!;
    const h = Math.max(2, islandHeight(isl, f.x, f.z));
    labels.push({ text: f.name, x: f.x, y: h + 26, z: f.z, kind: 'fort' });
    if (f.faction === 'france') {
      // Fort bastionné à la Vauban : enceinte étoilée, bastions, poudrière, pavillon royal.
      for (let k = 0; k < 5; k++) {
        const a = f.facing + (k / 5) * Math.PI * 2;
        const a2 = f.facing + ((k + 1) / 5) * Math.PI * 2;
        const x1 = f.x + Math.sin(a) * 26, z1 = f.z + Math.cos(a) * 26, x2 = f.x + Math.sin(a2) * 26, z2 = f.z + Math.cos(a2) * 26;
        const len = Math.hypot(x2 - x1, z2 - z1);
        stones.push(box(len, 9, 5, (x1 + x2) / 2, h + 3.5, (z1 + z2) / 2, Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2));
        const bast = new THREE.CylinderGeometry(0.1, 9, 9, 3);
        bast.rotateY(a);
        bast.translate(x1, h + 3.5, z1);
        stones.push(bast);
      }
      stones.push(box(14, 12, 14, f.x, h + 5, f.z, f.facing));
      for (let k = -2; k <= 2; k++) {
        const a = f.facing + k * 0.35;
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 4, 8).rotateX(Math.PI / 2), gunMat);
        g.position.set(f.x + Math.sin(a) * 27, h + 8.5, f.z + Math.cos(a) * 27);
        g.rotation.y = a;
        group.add(g);
      }
      woods.push(box(0.4, 18, 0.4, f.x, h + 20, f.z));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), new THREE.MeshStandardMaterial({ map: flagTexture('royal'), side: THREE.DoubleSide }));
      flag.position.set(f.x + 4.5, h + 26, f.z);
      group.add(flag);
    } else {
      // Repaire pirate : palissade, tour de guet, pavillon noir.
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        woods.push(box(1.4, 7 + Math.random() * 2, 1.4, f.x + Math.sin(a) * 22, h + 3, f.z + Math.cos(a) * 22));
      }
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) woods.push(box(0.8, 16, 0.8, f.x + dx, h + 8, f.z + dz));
      woods.push(box(9, 1, 9, f.x, h + 16, f.z), box(9, 3, 0.4, f.x, h + 18, f.z + 4.5), box(9, 3, 0.4, f.x, h + 18, f.z - 4.5));
      for (let k = -1; k <= 1; k++) {
        const a = f.facing + k * 0.5;
        const g = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 4, 8).rotateX(Math.PI / 2), gunMat);
        g.position.set(f.x + Math.sin(a) * 20, h + 4, f.z + Math.cos(a) * 20);
        g.rotation.y = a;
        group.add(g);
      }
      woods.push(box(0.4, 14, 0.4, f.x, h + 24, f.z));
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(8, 5.5), new THREE.MeshStandardMaterial({ map: flagTexture('pirate'), side: THREE.DoubleSide }));
      flag.position.set(f.x + 4, h + 28, f.z);
      group.add(flag);
    }
  }
  if (stones.length) {
    const sg = mergeGeometries(stones.map((g) => g.toNonIndexed()))!;
    const sm = new THREE.Mesh(sg, stoneMat);
    sm.receiveShadow = true;
    group.add(sm);
  }
  if (woods.length) {
    const wg = mergeGeometries(woods.map((g) => g.toNonIndexed()))!;
    const wm = new THREE.Mesh(wg, woodMat);
    group.add(wm);
  }

  // --- Épaves
  for (const w of world.wrecks) {
    const m = new ShipModel(SHIP_BY_ID[R() < 0.5 ? 'pirate_brick' : 'anglais_fregate'], undefined);
    m.update(0, 1, 0, 0, 0, 0.95, 1, 0);
    m.root.position.set(w.x, -m.dims.F * 0.9, w.z);
    m.root.rotation.set(0.35 + R() * 0.3, w.h, 0.4 + R() * 0.4, 'YXZ');
    m.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false; });
    group.add(m.root);
    disposables.push(m);
    labels.push({ text: w.name, x: w.x, y: 14, z: w.z, kind: 'epave' });
  }
  for (const isl of world.islands) if (!isl.port) labels.push({ text: isl.name, x: isl.x, y: Math.min(isl.height + 15, 90), z: isl.z, kind: 'ile' });

  // --- Carte des fonds (pour l'océan) et image de la mini-carte
  const N = 512;
  const data = new Uint8Array(N * N * 4);
  const mini = document.createElement('canvas');
  mini.width = mini.height = 256;
  const mg = mini.getContext('2d')!;
  const img = mg.createImageData(256, 256);
  const deep = new THREE.Color(zone.ambiance.deep), shallow = new THREE.Color(zone.ambiance.shallow);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = ((i + 0.5) / N - 0.5) * zone.half * 2, z = ((j + 0.5) / N - 0.5) * zone.half * 2;
      const t = terrainHeight(world, x, z);
      const v = Math.max(0, Math.min(255, Math.round(((t + 40) / 80) * 255)));
      const k = (j * N + i) * 4;
      data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
      if (i % 2 === 0 && j % 2 === 0) {
        const m = ((j / 2) * 256 + i / 2) * 4;
        let r: number, g: number, b: number;
        if (t > 0) {
          const l = Math.min(1, t / 60);
          r = 170 - l * 40; g = 150 - l * 35; b = 105 - l * 30;
          if (t < 2) { r = 205; g = 188; b = 140; }
        } else {
          const d = Math.min(1, -t / 25);
          const cc = shallow.clone().lerp(deep, d);
          r = cc.r * 255 * 1.3 + 20; g = cc.g * 255 * 1.3 + 20; b = cc.b * 255 * 1.3 + 25;
        }
        img.data[m] = r; img.data[m + 1] = g; img.data[m + 2] = b; img.data[m + 3] = 255;
      }
    }
  }
  mg.putImageData(img, 0, 0);
  const depthTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  depthTex.magFilter = THREE.LinearFilter;
  depthTex.minFilter = THREE.LinearFilter;
  depthTex.needsUpdate = true;

  return {
    group, depthTex, minimap: mini, world, lighthouses, windows: [windowsMat], labels,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const d of disposables) d.dispose();
      depthTex.dispose();
    },
  };
}
