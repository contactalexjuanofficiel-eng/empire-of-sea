// Particules en panneaux (billboards) instanciés : un seul appel de dessin par famille.
import * as THREE from 'three';
import { puffTexture } from './textures';

const VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec2 iSizeRot;
varying vec4 vColor;
varying vec2 vUv;
varying float vFog;
void main() {
  vUv = uv;
  vColor = iColor;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  float c = cos(iSizeRot.y), s = sin(iSizeRot.y);
  vec2 p = mat2(c, -s, s, c) * position.xy * iSizeRot.x;
  mv.xy += p;
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uAdditive;
uniform float uLight;
varying vec4 vColor;
varying vec2 vUv;
varying float vFog;
void main() {
  vec4 t = texture2D(uTex, vUv);
  vec4 c = vec4(vColor.rgb * uLight, vColor.a * t.a);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * vFog * vFog);
  c.rgb = mix(c.rgb, uFogColor, f * (1.0 - uAdditive));
  c.a *= 1.0 - f * uAdditive;
  if (c.a < 0.004) discard;
  gl_FragColor = c;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface ParticleOpts {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  life: number;
  size: number; size1?: number;
  color: THREE.ColorRepresentation; color1?: THREE.ColorRepresentation;
  alpha?: number; alpha1?: number;
  gravity?: number;
  drag?: number;
  spin?: number;
  buoyant?: boolean;
}

export class ParticleSystem {
  readonly mesh: THREE.Mesh;
  private max: number;
  private n = 0;
  private pos: Float32Array; private vel: Float32Array;
  private life: Float32Array; private maxLife: Float32Array;
  private s0: Float32Array; private s1: Float32Array;
  private c0: Float32Array; private c1: Float32Array;
  private a0: Float32Array; private a1: Float32Array;
  private grav: Float32Array; private drag: Float32Array; private rot: Float32Array; private spin: Float32Array;
  private iPos: THREE.InstancedBufferAttribute;
  private iColor: THREE.InstancedBufferAttribute;
  private iSize: THREE.InstancedBufferAttribute;
  private geo: THREE.InstancedBufferGeometry;
  readonly uniforms: Record<string, THREE.IUniform>;
  wind = new THREE.Vector3();

  constructor(max: number, additive: boolean, texture?: THREE.Texture) {
    this.max = max;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.iColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iSize = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('iPos', this.iPos);
    this.geo.setAttribute('iColor', this.iColor);
    this.geo.setAttribute('iSizeRot', this.iSize);
    this.geo.instanceCount = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.a0 = new Float32Array(max); this.a1 = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max);
    this.rot = new Float32Array(max); this.spin = new Float32Array(max);
    this.uniforms = { uTex: { value: texture ?? puffTexture() }, uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0 }, uAdditive: { value: additive ? 1 : 0 }, uLight: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
  }

  private tmp = new THREE.Color();
  emit(o: ParticleOpts) {
    let i = this.n;
    if (i >= this.max) i = Math.floor(Math.random() * this.max); // remplace une particule au hasard
    else this.n++;
    this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    this.vel[i * 3] = o.vx ?? 0; this.vel[i * 3 + 1] = o.vy ?? 0; this.vel[i * 3 + 2] = o.vz ?? 0;
    this.life[i] = 0; this.maxLife[i] = o.life;
    this.s0[i] = o.size; this.s1[i] = o.size1 ?? o.size;
    this.tmp.set(o.color);
    this.c0[i * 3] = this.tmp.r; this.c0[i * 3 + 1] = this.tmp.g; this.c0[i * 3 + 2] = this.tmp.b;
    this.tmp.set(o.color1 ?? o.color);
    this.c1[i * 3] = this.tmp.r; this.c1[i * 3 + 1] = this.tmp.g; this.c1[i * 3 + 2] = this.tmp.b;
    this.a0[i] = o.alpha ?? 1; this.a1[i] = o.alpha1 ?? 0;
    this.grav[i] = o.gravity ?? 0; this.drag[i] = o.drag ?? 0;
    this.rot[i] = Math.random() * 6.28; this.spin[i] = o.spin ?? (Math.random() - 0.5) * 0.6;
  }

  update(dt: number) {
    let w = 0;
    const P = this.iPos.array as Float32Array, C = this.iColor.array as Float32Array, S = this.iSize.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i] + dt;
      if (l >= this.maxLife[i]) continue;
      // compaction : on recopie la particule vivante à l'indice w
      if (w !== i) this.copy(i, w);
      this.life[w] = l;
      const k = l / this.maxLife[w];
      const dr = Math.max(0, 1 - this.drag[w] * dt);
      this.vel[w * 3] = this.vel[w * 3] * dr + this.wind.x * this.drag[w] * dt;
      this.vel[w * 3 + 1] = this.vel[w * 3 + 1] * dr - this.grav[w] * dt;
      this.vel[w * 3 + 2] = this.vel[w * 3 + 2] * dr + this.wind.z * this.drag[w] * dt;
      this.pos[w * 3] += this.vel[w * 3] * dt;
      this.pos[w * 3 + 1] += this.vel[w * 3 + 1] * dt;
      this.pos[w * 3 + 2] += this.vel[w * 3 + 2] * dt;
      this.rot[w] += this.spin[w] * dt;
      P[w * 3] = this.pos[w * 3]; P[w * 3 + 1] = this.pos[w * 3 + 1]; P[w * 3 + 2] = this.pos[w * 3 + 2];
      C[w * 4] = this.c0[w * 3] + (this.c1[w * 3] - this.c0[w * 3]) * k;
      C[w * 4 + 1] = this.c0[w * 3 + 1] + (this.c1[w * 3 + 1] - this.c0[w * 3 + 1]) * k;
      C[w * 4 + 2] = this.c0[w * 3 + 2] + (this.c1[w * 3 + 2] - this.c0[w * 3 + 2]) * k;
      // apparition rapide puis disparition
      const fadeIn = Math.min(1, k * 12);
      C[w * 4 + 3] = (this.a0[w] + (this.a1[w] - this.a0[w]) * k) * fadeIn;
      S[w * 2] = this.s0[w] + (this.s1[w] - this.s0[w]) * Math.sqrt(k);
      S[w * 2 + 1] = this.rot[w];
      w++;
    }
    this.n = w;
    this.geo.instanceCount = w;
    this.iPos.needsUpdate = true;
    this.iColor.needsUpdate = true;
    this.iSize.needsUpdate = true;
  }

  private copy(a: number, b: number) {
    for (let j = 0; j < 3; j++) {
      this.pos[b * 3 + j] = this.pos[a * 3 + j];
      this.vel[b * 3 + j] = this.vel[a * 3 + j];
      this.c0[b * 3 + j] = this.c0[a * 3 + j];
      this.c1[b * 3 + j] = this.c1[a * 3 + j];
    }
    this.maxLife[b] = this.maxLife[a];
    this.s0[b] = this.s0[a]; this.s1[b] = this.s1[a];
    this.a0[b] = this.a0[a]; this.a1[b] = this.a1[a];
    this.grav[b] = this.grav[a]; this.drag[b] = this.drag[a];
    this.rot[b] = this.rot[a]; this.spin[b] = this.spin[a];
  }

  setFog(color: THREE.Color, density: number) {
    (this.uniforms.uFogColor.value as THREE.Color).copy(color);
    this.uniforms.uFogDensity.value = density;
  }
}

/** Texture ronde et douce pour les flammes et les éclats. */
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
