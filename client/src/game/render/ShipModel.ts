// Modèles 3D de navires générés de façon procédurale à partir des caractéristiques de chaque bâtiment :
// coque à membrures, préceintes et sabords, galerie de poupe éclairée, mâture à trois étages de voiles,
// voiles qui se déploient selon l'allure demandée, gréement, canons en batterie, pavillon et lanternes.
import { ELITE_LIVERIES, eliteLook } from '../../../../shared/elite';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Fusionne des géométries (liste vide = géométrie vide, pour les gréements sans canons ni dorures). */
const mergeSafe = (list: THREE.BufferGeometry[]) => list.length ? mergeGeometries(list.map((g) => g.toNonIndexed()))! : new THREE.BufferGeometry();
import { SHIP_BY_ID, SHIP_CLASSES, type ShipDef } from '../../../../shared/ships';
import { deckTexture, emblemFor, flagTexture, sailTexture, woodTexture } from './textures';
import { SKINS, type SkinId } from '../../../../shared/extras';

export interface ShipDims {
  L: number;
  B: number;
  draft: number;
  F: number; // franc-bord au milieu
  decks: number;
  masts: { t: number; h: number; w: number }[];
}

export function dimsFor(def: ShipDef): ShipDims {
  const c = SHIP_CLASSES[def.cls];
  const L = def.size?.L ?? c.length, B = def.size?.B ?? c.beam;
  const decks = def.rig && def.rig !== 'carre' ? 0 : c.gunDecks;
  const F = 1.6 + decks * 2.3 + 0.08 * B;
  const nMasts = def.rig === 'goelette' || def.rig === 'dundee' ? 2 : def.rig ? 3 : c.masts;
  const H = L * (nMasts === 2 ? 0.95 : 0.9);
  const masts = def.rig === 'dundee'
    ? [{ t: 0.6, h: H, w: 1.0 }, { t: 0.2, h: H * 0.62, w: 0.7 }]
    : nMasts === 2
    ? [{ t: 0.66, h: H * 0.92, w: 1.0 }, { t: 0.36, h: H, w: 1.1 }]
    : [{ t: 0.73, h: H * 0.9, w: 1.0 }, { t: 0.5, h: H, w: 1.12 }, { t: 0.25, h: H * 0.74, w: 0.82 }];
  return { L, B, draft: 0.36 * B, F, decks, masts };
}

/** Demi-largeur relative de la coque le long du navire (t = 0 poupe, 1 proue). */
function widthAt(t: number) {
  if (t < 0.08) return 0.74 + (t / 0.08) * 0.13;
  if (t < 0.55) return 0.87 + 0.13 * Math.sin(((t - 0.08) / 0.47) * Math.PI / 2);
  return Math.pow(Math.max(0, Math.cos(((t - 0.55) / 0.45) * Math.PI / 2)), 0.72);
}
export function deckY(d: ShipDims, t: number) {
  const sheer = 0.16 * d.F * Math.pow(Math.abs(t - 0.5) * 2, 2);
  const smooth = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const quarter = (d.decks > 0 ? 1.7 : 0.9) * (1 - smooth(0.24, 0.31, t));
  const fore = (d.decks > 0 ? 1.0 : 0.5) * smooth(0.84, 0.9, t);
  return d.F + sheer + quarter + fore;
}
function keelY(d: ShipDims, t: number) {
  let k = -d.draft;
  if (t > 0.86) k *= 1 - Math.pow((t - 0.86) / 0.14, 1.6) * 0.75;
  if (t < 0.04) k *= 0.85 + (t / 0.04) * 0.15;
  return k;
}
/** Profil d'un couple : y normalisé (0 quille -> 1 plat-bord) vers largeur relative. */
function sectionShape(y: number, waterFrac: number) {
  if (y < waterFrac) {
    const q = 1 - y / waterFrac;
    return 0.08 + 0.92 * Math.sqrt(Math.max(0, 1 - q * q * q));
  }
  const a = (y - waterFrac) / (1 - waterFrac);
  return 1 - 0.13 * Math.pow(a, 1.6);
}
export function halfWidthAt(d: ShipDims, t: number, y: number) {
  const top = deckY(d, t) + 1.1, bot = keelY(d, t);
  const yn = (y - bot) / (top - bot);
  const wf = -bot / (top - bot);
  return (d.B / 2) * widthAt(t) * sectionShape(Math.min(1, Math.max(0, yn)), wf);
}

function buildHull(d: ShipDims) {
  const S = 44, M = 16;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const grid: number[][] = [];
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      const top = deckY(d, t) + 1.1, bot = keelY(d, t);
      const wf = -bot / (top - bot);
      for (let j = 0; j <= M; j++) {
        // Plus de rangées près de la flottaison.
        const u = j / M;
        const yn = u < 0.5 ? wf * (u / 0.5) : wf + (1 - wf) * ((u - 0.5) / 0.5);
        const y = bot + (top - bot) * yn;
        let z = -d.L / 2 + t * d.L;
        if (t > 0.86) z += Math.pow((t - 0.86) / 0.14, 2) * d.L * 0.05 * yn;
        if (t < 0.02) z -= yn * d.L * 0.018;
        const x = side * (d.B / 2) * widthAt(t) * sectionShape(yn, wf);
        pos.push(x, y, z);
        uv.push(z, yn);
      }
    }
    for (let i = 0; i < S; i++) for (let j = 0; j < M; j++) {
      const a = base + i * (M + 1) + j, b = a + M + 1;
      if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    grid.push([base]);
  }
  // Tableau arrière (miroir de poupe) entre les deux bordés.
  const L0 = grid[0][0], R0 = grid[1][0];
  for (let j = 0; j < M; j++) idx.push(L0 + j, L0 + j + 1, R0 + j, R0 + j, L0 + j + 1, R0 + j + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildDeck(d: ShipDims) {
  const S = 40;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= S; i++) {
    const t = 0.005 + (i / S) * 0.975;
    const y = deckY(d, t);
    const w = halfWidthAt(d, t, y) * 0.96;
    const z = -d.L / 2 + t * d.L;
    pos.push(-w, y, z, w, y, z);
    uv.push(-w / 4, z / 4, w / 4, z / 4);
  }
  for (let i = 0; i < S; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cyl(r0: number, r1: number, a: THREE.Vector3, b: THREE.Vector3, seg = 8) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

interface SailPart { geo: THREE.BufferGeometry; emblem: boolean }

/** Voile carrée trapézoïdale ; attribut aSail = (étage, haut, hauteur). */
function squareSail(z: number, yTop: number, yBot: number, wTop: number, wBot: number, level: number) {
  const g = new THREE.PlaneGeometry(1, 1, 8, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uvA = g.attributes.uv as THREE.BufferAttribute;
  const sail = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const u = uvA.getX(i), v = uvA.getY(i); // v = 1 en haut
    const y = yBot + (yTop - yBot) * v;
    const w = wBot + (wTop - wBot) * v;
    p.setXYZ(i, (u - 0.5) * w, y, z + 0.3);
    sail.set([level, yTop, yTop - yBot], i * 3);
  }
  g.setAttribute('aSail', new THREE.BufferAttribute(sail, 3));
  g.computeVertexNormals();
  return g;
}

/** Voile d'étai / brigantine (dans le plan longitudinal). */
function foreAftSail(pts: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3], level: number) {
  const g = new THREE.PlaneGeometry(1, 1, 6, 6);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uvA = g.attributes.uv as THREE.BufferAttribute;
  const sail = new Float32Array(p.count * 3);
  const [bl, br, tr, tl] = pts;
  const top = Math.max(tl.y, tr.y);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const u = uvA.getX(i), v = uvA.getY(i);
    tmp.copy(bl).lerp(br, u);
    tmp2.copy(tl).lerp(tr, u);
    tmp.lerp(tmp2, v);
    p.setXYZ(i, tmp.x, tmp.y, tmp.z);
    sail.set([level, top, top - Math.min(bl.y, br.y)], i * 3);
  }
  g.setAttribute('aSail', new THREE.BufferAttribute(sail, 3));
  g.computeVertexNormals();
  return g;
}

interface ShipAssets {
  dims: ShipDims;
  hull: THREE.BufferGeometry;
  deck: THREE.BufferGeometry;
  wood: THREE.BufferGeometry;
  gold: THREE.BufferGeometry;
  guns: THREE.BufferGeometry;
  sails: THREE.BufferGeometry;
  emblemSail: THREE.BufferGeometry | null;
  foreAft: THREE.BufferGeometry;
  rigging: THREE.BufferGeometry;
  lanterns: THREE.Vector3[];
  ports: { babord: THREE.Vector3[]; tribord: THREE.Vector3[] };
  firePoints: THREE.Vector3[];
  flagPos: THREE.Vector3;
  pennantPos: THREE.Vector3;
}

const assetCache = new Map<string, ShipAssets>();

function buildAssets(def: ShipDef): ShipAssets {
  const d = dimsFor(def);
  const { L, B } = d;
  const wood: THREE.BufferGeometry[] = [];
  const gold: THREE.BufferGeometry[] = [];
  const sails: THREE.BufferGeometry[] = [];
  const emblemParts: THREE.BufferGeometry[] = [];
  const foreAft: THREE.BufferGeometry[] = [];
  const rig: number[] = [];
  const line = (a: THREE.Vector3, b: THREE.Vector3) => rig.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const zAt = (t: number) => -L / 2 + t * L;

  // Mâture
  const mastTops: THREE.Vector3[] = [];
  const lowerTops: THREE.Vector3[] = [];
  const bowY = deckY(d, 0.99) + 0.6;
  const bowTip = V(0, bowY + L * 0.32 * Math.sin(0.33), L / 2 + L * 0.03 + L * 0.32 * Math.cos(0.33));
  wood.push(cyl(L * 0.009, L * 0.004, V(0, bowY - 0.4, L / 2 - 1.5), bowTip, 7));

  d.masts.forEach((m, mi) => {
    const z = zAt(m.t);
    const y0 = deckY(d, m.t);
    const H = m.h;
    const r = L * 0.0105 * m.w;
    const yLowTop = y0 + H * 0.45, yTopTop = y0 + H * 0.74, yTg = y0 + H;
    wood.push(cyl(r, r * 0.8, V(0, y0 - 1, z), V(0, yLowTop + 1.5, z), 10));
    wood.push(cyl(r * 0.62, r * 0.48, V(0, yLowTop - 1, z), V(0, yTopTop + 1, z), 8));
    wood.push(cyl(r * 0.4, r * 0.18, V(0, yTopTop - 0.5, z), V(0, yTg + 1.5, z), 6));
    // Hunes
    const hune = new THREE.CylinderGeometry(B * 0.16 * m.w, B * 0.16 * m.w, 0.35, 10);
    hune.translate(0, yLowTop, z);
    wood.push(hune);
    const barre = new THREE.CylinderGeometry(B * 0.09, B * 0.09, 0.25, 8);
    barre.translate(0, yTopTop, z);
    wood.push(barre);
    lowerTops.push(V(0, yLowTop, z));
    mastTops.push(V(0, yTg + 1.5, z));

    // Vergues et voiles carrées (sauf brigantine du mât d'artimon des trois-mâts : on garde ses huniers)
    const yCourse = y0 + H * 0.38, yTopsail = y0 + H * 0.66, yTgYard = y0 + H * 0.92;
    const wC = B * 1.9 * m.w, wT = B * 1.45 * m.w, wG = B * 0.95 * m.w;
    for (const [yy, ww] of [[yCourse, wC], [yTopsail, wT], [yTgYard, wG]] as const) {
      wood.push(cyl(0.22 * m.w, 0.22 * m.w, V(-ww / 2, yy, z + 0.6), V(ww / 2, yy, z + 0.6), 6));
    }
    const isMizzen = d.masts.length === 3 && mi === 2;
    const last = mi === d.masts.length - 1;
    // Gréement : carré (toutes voiles carrées), barque (dernier mât à voile aurique),
    // goélette (seul le hunier du mât de misaine est carré), dundee (voiles auriques uniquement).
    const rig = def.rig ?? 'carre';
    const squares = rig === 'carre' || (rig === 'barque' && !last) || (rig === 'goelette' && mi === 0 ? 'top' : false);
    if (squares === true) {
      const course = squareSail(z, yCourse, y0 + H * 0.12, wC * 0.98, wC * 1.08, 0);
      if (!isMizzen) {
        if (mi === 1 && def.look.emblem) emblemParts.push(course);
        else sails.push(course);
      }
      sails.push(squareSail(z, yTopsail, yCourse + 0.6, wT * 0.98, wC * 0.95, 1));
      sails.push(squareSail(z, yTgYard, yTopsail + 0.5, wG * 0.98, wT * 0.92, 2));
    } else if (squares === 'top') {
      sails.push(squareSail(z, yTopsail, yCourse + 0.6, wT * 0.9, wT * 1.1, 1));
    }
    if (rig !== 'carre' && !last) {
      // Voile aurique (grand-voile à corne) entre ce mât et le suivant.
      const nz = zAt(d.masts[mi + 1].t);
      const boom = V(0, y0 + 2.6, nz + 1.2);
      const gaff = V(0, y0 + H * 0.5, nz + 2.5);
      wood.push(cyl(0.16, 0.13, V(0, y0 + 2.5, z - 0.4), boom, 6));
      wood.push(cyl(0.14, 0.11, V(0, y0 + H * 0.56, z - 0.4), gaff, 6));
      foreAft.push(foreAftSail([V(0, y0 + 2.8, z - 0.5), boom.clone().setY(boom.y + 0.2), gaff, V(0, y0 + H * 0.56, z - 0.5)], 1));
    }

    // Haubans : du ton de chaque mât vers le plat-bord.
    for (const s of [1, -1]) {
      const hw = halfWidthAt(d, m.t, y0 + 1) + 0.3;
      for (let k = -2; k <= 2; k++) line(V(s * 0.3, yLowTop, z), V(s * hw, y0 + 1, z + k * 0.9 - 1));
      for (let k = -1; k <= 1; k++) line(V(s * 0.2, yTopTop, z), V(s * B * 0.16 * m.w, yLowTop, z + k * 0.6));
      line(V(s * 0.1, yTg, z), V(s * hw, y0 + 1, z - H * 0.18));
      // Enfléchures (échelons) suggérées
      for (let k = 1; k < 7; k++) {
        const f = k / 7;
        const ya = y0 + 1 + (yLowTop - y0 - 1) * f;
        const xa = s * (hw + (0.3 - hw) * f);
        line(V(xa, ya, z - 1.8 * (1 - f)), V(xa, ya, z + 1.8 * (1 - f)));
      }
    }
  });

  // Étais : d'avant en arrière
  line(lowerTops[0], bowTip);
  line(mastTops[0].clone().setY(mastTops[0].y - 2), bowTip);
  for (let i = 1; i < lowerTops.length; i++) {
    line(lowerTops[i], V(0, lowerTops[i - 1].y * 0.55, lowerTops[i - 1].z));
    line(mastTops[i], lowerTops[i - 1].clone().setY(lowerTops[i - 1].y + (mastTops[i - 1].y - lowerTops[i - 1].y) * 0.6));
  }

  // Focs
  const fm = d.masts[0];
  const fz = zAt(fm.t), fy = deckY(d, fm.t);
  for (let k = 0; k < 2; k++) {
    const tip = bowTip.clone().lerp(V(0, bowY, L / 2), k * 0.35);
    const head = V(0, fy + fm.h * (0.62 - k * 0.14), fz + 0.5);
    const foot = V(0, fy + 2.2, fz + (L / 2 - fz) * 0.55 + k * 2);
    foreAft.push(foreAftSail([foot, tip, tip.clone().lerp(head, 0.02), head], 2));
  }
  // Brigantine sur le mât arrière
  const am = d.masts[d.masts.length - 1];
  const az = zAt(am.t), ay = deckY(d, am.t);
  const boomEnd = V(0, ay + 3.2, -L / 2 - L * 0.06);
  wood.push(cyl(0.18, 0.15, V(0, ay + 3, az), boomEnd, 6));
  const gaffEnd = V(0, ay + am.h * 0.42, -L / 2 + L * 0.02);
  wood.push(cyl(0.16, 0.13, V(0, ay + am.h * 0.36, az), gaffEnd, 6));
  foreAft.push(foreAftSail([V(0, ay + 3.3, az - 0.4), boomEnd.clone().setY(boomEnd.y + 0.2), gaffEnd, V(0, ay + am.h * 0.36, az - 0.4)], 1));

  // Canons en batterie et positions des bouches à feu
  const perSide = def.noPorts ? 0 : Math.round(def.canons / 2);
  const rows = Math.max(1, d.decks);
  const perRow = Math.ceil(perSide / rows);
  const ports = { babord: [] as THREE.Vector3[], tribord: [] as THREE.Vector3[] };
  const gunGeo: THREE.BufferGeometry[] = [];
  for (let r = 0; r < rows; r++) {
    const yk = d.decks > 0 ? 1.45 + r * 2.3 : d.F + 0.35;
    const n = Math.min(perRow, 16);
    for (let i = 0; i < n; i++) {
      const t = 0.2 + (i + 0.5) / n * 0.58;
      const z = zAt(t);
      const hw = halfWidthAt(d, t, yk);
      for (const s of [1, -1]) {
        const g = cyl(0.26, 0.2, V(s * (hw - 0.5), yk, z), V(s * (hw + 0.9), yk, z), 7);
        gunGeo.push(g);
        (s > 0 ? ports.babord : ports.tribord).push(V(s * (hw + 1.0), yk, z));
      }
    }
  }

  // Dorures : figure de proue, couronnement de poupe, lisse.
  const fig = new THREE.ConeGeometry(0.5 + L * 0.008, L * 0.05, 8);
  fig.rotateX(Math.PI / 2 + 0.5);
  fig.translate(0, bowY - 1.2, L / 2 + L * 0.03);
  gold.push(fig);
  const sternTop = deckY(d, 0) + 1.1;
  const crown = new THREE.TorusGeometry(B * 0.22, 0.18 + B * 0.01, 6, 16, Math.PI);
  crown.translate(0, sternTop, -L / 2 - L * 0.02);
  gold.push(crown);
  const lanterns: THREE.Vector3[] = [];
  const nl = def.cls === 'amiral' ? 3 : def.cls === 'trois_ponts' || def.cls === 'vaisseau' ? 3 : 1;
  for (let i = 0; i < nl; i++) {
    const x = nl === 1 ? 0 : (i - 1) * B * 0.28;
    const p = V(x, sternTop + 1.6 + (i === 1 ? 0.5 : 0), -L / 2 - L * 0.025);
    lanterns.push(p);
    gold.push(cyl(0.08, 0.08, V(x, sternTop, p.z + 0.2), p, 5));
  }
  // Mât de pavillon arrière
  const flagPole = V(0, sternTop + L * 0.11, -L / 2 - L * 0.03);
  wood.push(cyl(0.1, 0.07, V(0, sternTop - 0.5, -L / 2 + 0.4), flagPole, 5));

  const firePoints: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const t = 0.15 + i * 0.13;
    firePoints.push(V((Math.random() - 0.5) * B * 0.5, deckY(d, t) + 0.5, zAt(t)));
  }

  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rig, 3));

  return {
    dims: d,
    hull: buildHull(d),
    deck: buildDeck(d),
    wood: mergeSafe(wood),
    gold: mergeSafe(gold),
    guns: mergeSafe(gunGeo),
    sails: mergeSafe(sails),
    emblemSail: emblemParts.length ? mergeSafe(emblemParts) : null,
    foreAft: mergeSafe(foreAft),
    rigging: rg,
    lanterns,
    ports,
    firePoints,
    flagPos: flagPole,
    pennantPos: mastTops[d.masts.length > 2 ? 1 : 1],
  };
}

function assets(def: ShipDef) {
  let a = assetCache.get(def.id);
  if (!a) { a = buildAssets(def); assetCache.set(def.id, a); }
  return a;
}

// ---------------------------------------------------------------------------- matériaux

function hullMaterial(def: ShipDef, d: ShipDims) {
  const m = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide });
  const u = {
    uHull: { value: new THREE.Color(def.look.hull) },
    uStripe: { value: new THREE.Color(def.look.stripe) },
    uTrim: { value: new THREE.Color(def.look.trim) },
    uCopper: { value: new THREE.Color(0x7a4a2e) },
    uDamage: { value: 0 },
    uLights: { value: 0 },
    uGlow: { value: new THREE.Color(def.look.glow ?? 0x000000) },
    uL: { value: d.L },
    uDecks: { value: d.decks },
    uF: { value: d.F },
    uPorts: { value: def.noPorts ? 0 : Math.max(4, Math.min(16, Math.ceil(def.canons / 2 / Math.max(1, d.decks)))) },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLocN; varying float vHullV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position; vLocN = normal; vHullV = uv.y;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vec2(position.z / 7.0, position.y / 3.5);\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLoc; varying vec3 vLocN; varying float vHullV;
uniform vec3 uHull, uStripe, uTrim, uCopper, uGlow; uniform float uDamage, uLights, uL, uDecks, uF, uPorts;
float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float nn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(hh(i),hh(i+vec2(1,0)),u.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),u.x),u.y); }
float gTrim; float gWin;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 c = uHull;
  float y = vLoc.y;
  float tz = (vLoc.z + uL * 0.5) / uL;
  gTrim = 0.0; gWin = 0.0;
  // Préceintes et bandes de batterie
  float nd = max(1.0, uDecks);
  for (int k = 0; k < 3; k++) {
    if (float(k) >= nd) break;
    float yk = uDecks > 0.5 ? 1.45 + float(k) * 2.3 : uF + 0.35;
    float band = step(abs(y - yk), 0.85);
    c = mix(c, uStripe, band);
    // Sabords
    float cell = fract((tz - 0.2) / 0.58 * uPorts);
    float inPorts = step(0.2, tz) * step(tz, 0.78);
    float port = step(0.5, uPorts) * inPorts * step(abs(cell - 0.5), 0.2) * step(abs(y - yk), 0.5) * step(abs(vLocN.x), 2.0) * step(0.25, abs(vLocN.x));
    c = mix(c, vec3(0.04, 0.03, 0.02), port);
  }
  // Lisse dorée
  c = mix(c, uTrim, step(0.965, vHullV)); gTrim = step(0.965, vHullV);
  // Flottaison : liston noir puis doublage de cuivre
  c = mix(c, vec3(0.03), step(y, 0.35) * step(-0.25, y));
  c = mix(c, uCopper * (0.75 + 0.25 * nn(vLoc.xz * 0.8)), step(y, -0.25));
  // Miroir de poupe : galerie à fenêtres
  if (vLocN.z < -0.6 && y > uF - 1.0) {
    vec2 w = vec2(fract(vLoc.x / 1.6), fract((y - uF) / 2.2));
    float win = step(0.25, w.x) * step(w.x, 0.75) * step(0.25, w.y) * step(w.y, 0.8);
    c = mix(uTrim * 0.8, vec3(0.08, 0.06, 0.04), win);
    gWin = win; gTrim = max(gTrim, 1.0 - win);
  }
  // Dégâts : bois noirci et brûlé
  float burn = smoothstep(1.0 - uDamage, 1.0 - uDamage + 0.25, nn(vLoc.xz * 0.35 + vLoc.y * 0.5) * 0.7 + nn(vLoc.xz * 1.7) * 0.3);
  c = mix(c, vec3(0.05, 0.035, 0.025), burn * min(1.0, uDamage * 1.5));
  diffuseColor.rgb = c * (0.55 + 0.45 * diffuseColor.rgb * 1.6);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.35, gTrim);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.85, gTrim);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.62, 0.25) * gWin * uLights * 2.5 + uGlow * 0.35;');
  };
  m.customProgramCacheKey = () => 'hull-v3';
  return { m, u };
}

const SAIL_VERT_HEAD = `
attribute vec3 aSail;
uniform float uSet0, uSet1, uSet2, uBillow, uTime, uFoSign, uFore;
`;
function sailDeform(foreAft: boolean) {
  return `
{
  float lvl = aSail.x;
  float deploy = lvl < 0.5 ? uSet0 : lvl < 1.5 ? uSet1 : uSet2;
  float top = aSail.y, h = max(0.01, aSail.z);
  float v = clamp((top - transformed.y) / h, 0.0, 1.0);
  transformed.y = top - (top - transformed.y) * max(deploy, 0.04);
  float u = uv.x;
  float belly = sin(3.14159 * u) * sin(3.14159 * (0.12 + 0.88 * v));
  float flutter = sin(uTime * 3.1 + transformed.y * 0.7 + u * 5.0) * 0.08 + sin(uTime * 5.3 + u * 9.0) * 0.04;
  float amt = (uBillow + flutter * (1.2 - uBillow)) * h * 0.16 * deploy;
  ${foreAft ? 'transformed.x += uFoSign * amt * 1.2;' : 'transformed.z += amt;'}
}`;
}

function sailMaterial(tex: THREE.Texture, u: Record<string, THREE.IUniform>, foreAft: boolean, glow: number) {
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, alphaTest: 0.5, emissive: new THREE.Color(glow), emissiveIntensity: glow ? 0.25 : 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + SAIL_VERT_HEAD)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + sailDeform(foreAft));
    // Translucidité : la toile laisse passer un peu de lumière.
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * 0.18;');
  };
  m.customProgramCacheKey = () => (foreAft ? 'sail-fa-v2' : 'sail-sq-v2');
  return m;
}

function flagMaterial(tex: THREE.Texture, u: Record<string, THREE.IUniform>) {
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.4 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fx = uv.x; transformed.z += sin(uTime * 6.0 - fx * 7.0) * fx * 0.18 * position.x; transformed.y += sin(uTime * 4.0 - fx * 5.0) * fx * 0.05;');
  };
  m.customProgramCacheKey = () => 'flag-v1';
  return m;
}

// ---------------------------------------------------------------------------- instance

export class ShipModel {
  readonly def: ShipDef;
  readonly root = new THREE.Group(); // cap + position
  readonly body = new THREE.Group(); // tangage / roulis / pilonnement
  readonly dims: ShipDims;
  readonly ports: ShipAssets['ports'];
  readonly firePoints: THREE.Vector3[];
  readonly lanternPos: THREE.Vector3[];
  private hullU: Record<string, THREE.IUniform>;
  private sailU: Record<string, THREE.IUniform>;
  private flagU: Record<string, THREE.IUniform>;
  private setCur = [0, 0, 0];
  private lanternMat: THREE.MeshStandardMaterial;
  private mats: THREE.Material[] = [];

  constructor(baseDef: ShipDef, flagOverride?: 'royal' | 'tricolore' | 'imperial', skin?: SkinId | null, elite = 0) {
    // Navire élite : livrée de son niveau (coque, bandeau, dorures, voiles), prioritaire sur le pont décoré.
    // Sinon, pont décoré (doré, bleu) : on repeint préceintes, dorures, voiles et pont.
    const sk = skin && !(elite && baseDef.elite) ? SKINS[skin] : undefined;
    const def: ShipDef = elite && baseDef.elite ? { ...baseDef, look: eliteLook(baseDef.look, elite) }
      : sk ? { ...baseDef, look: { ...baseDef.look, stripe: sk.stripe, trim: sk.trim, sail: sk.sail } } : baseDef;
    this.def = def;
    const a = assets(def);
    this.dims = a.dims;
    this.ports = a.ports;
    this.firePoints = a.firePoints;
    this.lanternPos = a.lanterns;
    const { m: hullM, u } = hullMaterial(def, a.dims);
    this.hullU = u;
    const hull = new THREE.Mesh(a.hull, hullM);
    hull.castShadow = hull.receiveShadow = true;

    // Vu de dessus, c'est surtout le pont qu'on voit : il prend la teinte de la livrée élite.
    const livery = elite && baseDef.elite ? ELITE_LIVERIES[Math.max(1, Math.min(15, elite)) - 1] : null;
    const deckColor = livery ? new THREE.Color(0xffffff).lerp(new THREE.Color(livery.sail), 0.65) : new THREE.Color(sk ? sk.deck : 0xffffff);
    const deck = new THREE.Mesh(a.deck, new THREE.MeshStandardMaterial({ map: deckTexture(), roughness: sk || livery ? 0.45 : 0.85, color: deckColor, metalness: sk?.id === 'dore' || (livery && livery.level >= 5) ? 0.35 : 0 }));
    deck.receiveShadow = true;
    const woodM = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.8 });
    const wood = new THREE.Mesh(a.wood, woodM);
    wood.castShadow = true;
    const goldM = new THREE.MeshStandardMaterial({ color: def.look.trim, metalness: 0.9, roughness: 0.32, emissive: new THREE.Color(def.look.glow ?? 0), emissiveIntensity: def.look.glow ? 0.6 : 0 });
    const gold = new THREE.Mesh(a.gold, goldM);
    const guns = new THREE.Mesh(a.guns, new THREE.MeshStandardMaterial({ color: 0x1c1c1e, metalness: 0.7, roughness: 0.45 }));

    this.sailU = { uSet0: { value: 0 }, uSet1: { value: 0 }, uSet2: { value: 0 }, uBillow: { value: 0.6 }, uTime: { value: 0 }, uFoSign: { value: 1 }, uFore: { value: 1 } };
    const tattered = def.look.flag === 'spectre';
    const plain = sailTexture(def.look.sail, 'none', tattered);
    const sailM = sailMaterial(plain, this.sailU, false, def.look.glow ?? 0);
    const sails = new THREE.Mesh(a.sails, sailM);
    sails.castShadow = true;
    const foreM = sailMaterial(plain, this.sailU, true, def.look.glow ?? 0);
    const fore = new THREE.Mesh(a.foreAft, foreM);
    fore.castShadow = true;
    this.body.add(hull, deck, wood, gold, guns, sails, fore);
    this.mats.push(hullM, deck.material as THREE.Material, woodM, goldM, guns.material as THREE.Material, sailM, foreM);
    if (a.emblemSail) {
      const em = sailMaterial(sailTexture(def.look.sail, emblemFor(def.look, def.id), tattered), this.sailU, false, def.look.glow ?? 0);
      const es = new THREE.Mesh(a.emblemSail, em);
      es.castShadow = true;
      this.body.add(es);
      this.mats.push(em);
    }
    const rig = new THREE.LineSegments(a.rigging, new THREE.LineBasicMaterial({ color: 0x1d150e, transparent: true, opacity: 0.85 }));
    this.body.add(rig);

    // Pavillon de poupe et flamme de grand mât
    this.flagU = { uTime: { value: 0 } };
    const flagStyle = flagOverride ?? def.look.flag;
    const fm = flagMaterial(flagTexture(flagStyle), this.flagU);
    const fs = a.dims.L * 0.11;
    const fg = new THREE.PlaneGeometry(fs * 1.5, fs, 10, 4);
    fg.translate(-fs * 0.75, -fs * 0.5, 0);
    const flag = new THREE.Mesh(fg, fm);
    flag.position.copy(a.flagPos);
    flag.rotation.y = Math.PI / 2;
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(fs * 1.1, fs * 0.7, 10, 3).translate(-fs * 0.55, -fs * 0.35, 0), fm);
    pen.position.copy(a.pennantPos);
    pen.rotation.y = Math.PI / 2;
    this.body.add(flag, pen);
    this.mats.push(fm);

    // Lanternes de poupe
    this.lanternMat = new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xffa040, emissiveIntensity: 0.4, roughness: 0.4 });
    for (const p of a.lanterns) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.45 + a.dims.L * 0.004, 10, 8), this.lanternMat);
      l.position.copy(p);
      this.body.add(l);
    }
    this.root.add(this.body);
  }

  /**
   * @param sail niveau de voilure 0..3
   * @param windRel angle du vent par rapport au cap (0 = vent arrière)
   */
  update(t: number, dt: number, sail: number, windRel: number, windStrength: number, damage: number, sailDamage: number, night: number) {
    const target = [sail >= 2 ? 1 : 0, sail >= 1 ? 1 : 0, sail >= 3 ? 1 : 0];
    for (let i = 0; i < 3; i++) this.setCur[i] += (target[i] - this.setCur[i]) * Math.min(1, dt * 1.2);
    this.sailU.uSet0.value = this.setCur[0];
    this.sailU.uSet1.value = this.setCur[1];
    this.sailU.uSet2.value = this.setCur[2];
    const rel = Math.abs(windRel);
    const fill = rel > 2.7 ? 0.15 : 0.55 + 0.45 * Math.cos(Math.min(rel, 2.0) * 0.5);
    this.sailU.uBillow.value = fill * windStrength * (1 - sailDamage * 0.5);
    this.sailU.uFoSign.value = windRel > 0 ? 1 : -1;
    this.sailU.uTime.value = t;
    this.flagU.uTime.value = t;
    this.hullU.uDamage.value = damage;
    this.hullU.uLights.value = night;
    this.lanternMat.emissiveIntensity = 0.3 + night * 4;
  }

  dispose() {
    for (const m of this.mats) m.dispose();
    this.lanternMat.dispose();
  }
}

export function shipDef(id: string) {
  return SHIP_BY_ID[id] ?? SHIP_BY_ID.bayonnaise;
}
