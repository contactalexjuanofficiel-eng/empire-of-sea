// Textures procédurales dessinées à la volée (aucun fichier image externe : tout est original).
import * as THREE from 'three';
import type { FlagStyle } from '../../../../shared/ships';
import { rng } from '../../../../shared/math';

const cache = new Map<string, THREE.Texture>();
function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}
function tex(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) { t = make(); cache.set(key, t); }
  return t;
}

/** Bordages de chêne : lattes horizontales, joints calfatés, nuances et nœuds. */
export function woodTexture() {
  return tex('wood', () => {
    const { c, g } = canvas(512, 512);
    const R = rng(7);
    g.fillStyle = '#7a6a58';
    g.fillRect(0, 0, 512, 512);
    const plank = 32;
    for (let y = 0; y < 512; y += plank) {
      let x = -Math.floor(R() * 200);
      while (x < 512) {
        const w = 180 + R() * 220;
        const l = 0.78 + R() * 0.3;
        g.fillStyle = `rgb(${Math.round(150 * l)},${Math.round(135 * l)},${Math.round(115 * l)})`;
        g.fillRect(x, y, w, plank);
        for (let i = 0; i < 14; i++) {
          g.strokeStyle = `rgba(40,30,20,${0.05 + R() * 0.08})`;
          g.beginPath();
          const yy = y + R() * plank;
          g.moveTo(x, yy);
          g.bezierCurveTo(x + w * 0.3, yy + (R() - 0.5) * 4, x + w * 0.6, yy + (R() - 0.5) * 4, x + w, yy);
          g.stroke();
        }
        g.fillStyle = 'rgba(20,14,8,0.6)';
        g.fillRect(x, y, 2, plank);
        x += w;
      }
      g.fillStyle = 'rgba(15,10,6,0.7)';
      g.fillRect(0, y, 512, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Pont : lattes claires, plus larges. */
export function deckTexture() {
  return tex('deck', () => {
    const { c, g } = canvas(256, 256);
    const R = rng(11);
    for (let x = 0; x < 256; x += 16) {
      const l = 0.85 + R() * 0.2;
      g.fillStyle = `rgb(${Math.round(176 * l)},${Math.round(150 * l)},${Math.round(112 * l)})`;
      g.fillRect(x, 0, 16, 256);
      g.fillStyle = 'rgba(40,28,16,0.55)';
      g.fillRect(x, 0, 1.5, 256);
      for (let y = Math.floor(R() * 120); y < 256; y += 100 + R() * 80) g.fillRect(x, y, 16, 1.5);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

function fleurDeLys(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  g.fillStyle = color;
  g.beginPath();
  // pétale central
  g.moveTo(0, -50);
  g.bezierCurveTo(18, -30, 16, -5, 0, 10);
  g.bezierCurveTo(-16, -5, -18, -30, 0, -50);
  // pétales latéraux
  for (const sx of [-1, 1]) {
    g.moveTo(sx * 4, 6);
    g.bezierCurveTo(sx * 30, -10, sx * 52, -20, sx * 44, -38);
    g.bezierCurveTo(sx * 60, -18, sx * 46, 14, sx * 12, 20);
  }
  g.fill();
  g.fillRect(-26, 14, 52, 9);
  g.beginPath();
  g.moveTo(-6, 23);
  g.lineTo(6, 23);
  g.lineTo(3, 48);
  g.lineTo(-3, 48);
  g.fill();
  g.restore();
}

function sunEmblem(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  for (let i = 0; i < 16; i++) {
    g.rotate(Math.PI / 8);
    g.beginPath();
    g.moveTo(-r * 0.12, r * 0.55);
    g.lineTo(0, r * (i % 2 ? 1.0 : 0.82));
    g.lineTo(r * 0.12, r * 0.55);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Toile de voile : laizes cousues, bandes de ris, salissures ; emblème optionnel, trous pour les épaves/spectres. */
export function sailTexture(color: number, emblem: 'none' | 'lys' | 'soleil' | 'aigle', tattered = false) {
  return tex(`sail:${color}:${emblem}:${tattered}`, () => {
    const { c, g } = canvas(256, 256);
    const col = new THREE.Color(color);
    const base = `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`;
    g.fillStyle = base;
    g.fillRect(0, 0, 256, 256);
    const R = rng(color);
    for (let x = 0; x < 256; x += 18) {
      g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.04})`;
      g.fillRect(x, 0, 18, 256);
      g.fillStyle = 'rgba(60,45,30,0.18)';
      g.fillRect(x, 0, 1, 256);
    }
    for (const y of [40, 70]) {
      g.fillStyle = 'rgba(60,45,30,0.25)';
      g.fillRect(0, y, 256, 2);
      for (let x = 6; x < 256; x += 12) g.fillRect(x, y - 3, 1.5, 8);
    }
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(70,55,35,0.28)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(60,45,30,0.5)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, 252, 252);
    if (emblem === 'lys') fleurDeLys(g, 128, 140, 90, 'rgba(196,154,48,0.92)');
    if (emblem === 'soleil') sunEmblem(g, 128, 135, 70, 'rgba(214,166,46,0.92)');
    if (emblem === 'aigle') {
      g.fillStyle = 'rgba(190,150,50,0.9)';
      g.font = 'bold 120px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('N', 128, 140);
      g.strokeStyle = 'rgba(190,150,50,0.9)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(128, 140, 80, 0, Math.PI * 2);
      g.stroke();
    }
    if (tattered) {
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        const x = R() * 256, y = R() * 256, r = 6 + R() * 26;
        g.ellipse(x, y, r, r * (0.5 + R()), R() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

/** Pavillons (originaux, inspirés des pavillons historiques). */
export function flagTexture(style: FlagStyle) {
  return tex(`flag:${style}`, () => {
    const { c, g } = canvas(192, 128);
    switch (style) {
      case 'royal':
        g.fillStyle = '#f4f1e6';
        g.fillRect(0, 0, 192, 128);
        for (const [x, y] of [[48, 40], [144, 40], [96, 88], [32, 104], [160, 104]]) fleurDeLys(g, x, y, 34, '#c9a133');
        break;
      case 'tricolore':
      case 'imperial':
        g.fillStyle = '#1f3a8a'; g.fillRect(0, 0, 64, 128);
        g.fillStyle = '#f4f1e6'; g.fillRect(64, 0, 64, 128);
        g.fillStyle = '#c3242b'; g.fillRect(128, 0, 64, 128);
        if (style === 'imperial') {
          g.fillStyle = '#c9a133';
          g.font = 'bold 54px serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('N', 96, 66);
        }
        break;
      case 'pirate': {
        g.fillStyle = '#111';
        g.fillRect(0, 0, 192, 128);
        g.fillStyle = '#e9e4d8';
        g.beginPath(); g.arc(96, 52, 24, 0, Math.PI * 2); g.fill();
        g.fillRect(84, 66, 24, 14);
        g.fillStyle = '#111';
        g.beginPath(); g.arc(87, 50, 6, 0, Math.PI * 2); g.arc(105, 50, 6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#e9e4d8';
        g.lineWidth = 9;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(58, 88); g.lineTo(134, 118); g.moveTo(134, 88); g.lineTo(58, 118); g.stroke();
        break;
      }
      case 'anglais':
        g.fillStyle = '#b3202a';
        g.fillRect(0, 0, 192, 128);
        g.fillStyle = '#f4f1e6';
        g.fillRect(0, 0, 80, 56);
        g.fillStyle = '#b3202a';
        g.fillRect(32, 0, 16, 56);
        g.fillRect(0, 20, 80, 16);
        break;
      case 'barbaresque':
        g.fillStyle = '#1e6b3e';
        g.fillRect(0, 0, 192, 128);
        g.fillStyle = '#e9e4d8';
        g.beginPath(); g.arc(90, 64, 32, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#1e6b3e';
        g.beginPath(); g.arc(102, 60, 28, 0, Math.PI * 2); g.fill();
        break;
      case 'spectre':
        g.fillStyle = '#2b3b36';
        g.fillRect(0, 0, 192, 128);
        g.fillStyle = 'rgba(120,255,200,0.6)';
        g.beginPath(); g.arc(96, 60, 26, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(150 + Math.random() * 42, Math.random() * 128, 8 + Math.random() * 14, 0, 7); g.fill(); }
        g.globalCompositeOperation = 'source-over';
        break;
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Bouffée de fumée douce (pour les particules). */
export function puffTexture() {
  return tex('puff', () => {
    const { c, g } = canvas(128, 128);
    const R = rng(3);
    for (let i = 0; i < 22; i++) {
      const x = 64 + (R() - 0.5) * 50, y = 64 + (R() - 0.5) * 50, r = 18 + R() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.22)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }
    const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    return t;
  });
}

/** Carte de normales d'eau répétable, générée par une somme d'ondes périodiques. */
export function waterNormalTexture() {
  return tex('waterN', () => {
    const N = 256;
    const h = new Float32Array(N * N);
    const R = rng(42);
    const comps: [number, number, number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const kx = Math.round((R() - 0.5) * 24), ky = Math.round((R() - 0.5) * 24);
      if (!kx && !ky) continue;
      const amp = 1 / Math.pow(Math.hypot(kx, ky), 1.3);
      comps.push([kx, ky, amp, R() * Math.PI * 2]);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0;
      for (const [kx, ky, a, p] of comps) v += a * Math.sin(((kx * x + ky * y) / N) * Math.PI * 2 + p);
      h[y * N + x] = v;
    }
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x - 1 + N) % N)];
      const dy = h[((y + 1) % N) * N + x] - h[((y - 1 + N) % N) * N + x];
      const n = new THREE.Vector3(-dx * 1.5, -dy * 1.5, 1).normalize();
      const i = (y * N + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  });
}

/** Grain de terrain (herbe, roche) pour casser l'uniformité des îles. */
export function grainTexture() {
  return tex('grain', () => {
    const { c, g } = canvas(256, 256);
    const img = g.createImageData(256, 256);
    const R = rng(5);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 200 + R() * 55;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${R() * 0.12})`;
      g.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function emblemFor(look: { flag: FlagStyle; emblem?: boolean }, shipId: string): 'none' | 'lys' | 'soleil' | 'aigle' {
  if (!look.emblem) return 'none';
  if (shipId === 'soleil_royal') return 'soleil';
  if (look.flag === 'imperial') return 'aigle';
  return 'lys';
}
