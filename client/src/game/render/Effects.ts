// Effets de combat et d'ambiance : bordées (éclairs + nuages de poudre), boulets, gerbes, impacts, incendies,
// explosions, sillages d'écume et étincelles des trésors.
import * as THREE from 'three';
import type { AmmoId } from '../../../../shared/items';
import { GRAVITY } from '../../../../shared/physics';
import { glowTexture, ParticleSystem } from './Particles';
import { waveHeight } from './waves';

interface LiveBall { pid: number; t0: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; ammo: AmmoId; flashed: boolean; done: boolean; owner: number }

export class Effects {
  readonly group = new THREE.Group();
  readonly smoke = new ParticleSystem(6000, false);
  readonly fire = new ParticleSystem(4000, true, glowTexture());
  readonly spray = new ParticleSystem(4000, false, glowTexture());
  private balls: LiveBall[] = [];
  private ballMesh: THREE.InstancedMesh;
  private hotMesh: THREE.InstancedMesh;
  private flashLight = new THREE.PointLight(0xffaa55, 0, 160, 1.6);
  private flashT = 0;
  private m4 = new THREE.Matrix4();
  onSplash: ((x: number, z: number) => void) | null = null;
  onMuzzle: ((x: number, y: number, z: number, owner: number) => void) | null = null;

  constructor() {
    this.ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.6, roughness: 0.4 }), 800);
    this.hotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7a2a }), 300);
    this.ballMesh.frustumCulled = this.hotMesh.frustumCulled = false;
    this.group.add(this.smoke.mesh, this.fire.mesh, this.spray.mesh, this.ballMesh, this.hotMesh, this.flashLight);
  }

  addBall(pid: number, owner: number, t0: number, b: { x: number; y: number; z: number; vx: number; vy: number; vz: number }, ammo: AmmoId) {
    this.balls.push({ pid, owner, t0, ...b, ammo, flashed: false, done: false });
  }

  removeBall(pid: number) {
    const b = this.balls.find((x) => x.pid === pid);
    if (b) b.done = true;
  }

  // ---------------------------------------------------------------- effets ponctuels
  muzzle(x: number, y: number, z: number, dx: number, dz: number, big = 1) {
    for (let i = 0; i < 3; i++) {
      this.fire.emit({ x, y, z, vx: dx * (20 + i * 12), vy: 1, vz: dz * (20 + i * 12), life: 0.18, size: 3.5 * big, size1: 6 * big, color: 0xffe2a0, color1: 0xff6a20, alpha: 1, alpha1: 0, drag: 6 });
    }
    // Nuage de poudre blanc-gris qui s'étale puis dérive avec le vent.
    for (let i = 0; i < 4; i++) {
      const s = 6 + Math.random() * 18;
      this.smoke.emit({ x: x + dx * i * 1.5, y: y + Math.random(), z: z + dz * i * 1.5, vx: dx * s + (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, vz: dz * s + (Math.random() - 0.5) * 2, life: 5 + Math.random() * 4, size: 3 * big, size1: 16 * big + Math.random() * 8, color: 0xe8e4dc, color1: 0xb9b6b0, alpha: 0.75, alpha1: 0, drag: 0.9 });
    }
    this.flash(x, y, z, 3.5 * big);
  }

  flash(x: number, y: number, z: number, power: number) {
    this.flashLight.position.set(x, y + 2, z);
    this.flashLight.intensity = Math.max(this.flashLight.intensity, power * 900);
    this.flashT = 0.12;
  }

  splash(x: number, z: number, t: number) {
    const y = waveHeight(x, z, t);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 1.6;
      this.spray.emit({ x: x + Math.cos(a) * r, y, z: z + Math.sin(a) * r, vx: Math.cos(a) * 2, vy: 9 + Math.random() * 11, vz: Math.sin(a) * 2, life: 1.3 + Math.random() * 0.5, size: 1.2, size1: 2.4, color: 0xf2f6f8, color1: 0xcfdde4, alpha: 0.9, alpha1: 0, gravity: 18 });
    }
    for (let i = 0; i < 5; i++) {
      this.smoke.emit({ x, y: y + 1, z, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 4, life: 1.6, size: 3, size1: 8, color: 0xf6fafc, color1: 0xdfe8ec, alpha: 0.55, alpha1: 0, drag: 1.5 });
    }
  }

  hit(x: number, y: number, z: number, fire: boolean, crit: boolean) {
    for (let i = 0; i < (crit ? 26 : 14); i++) {
      this.spray.emit({ x, y, z, vx: (Math.random() - 0.5) * 22, vy: 4 + Math.random() * 12, vz: (Math.random() - 0.5) * 22, life: 1.2 + Math.random(), size: 0.5 + Math.random() * 0.7, color: 0x5a3b22, color1: 0x2a1a10, alpha: 1, alpha1: 0.8, gravity: 26, spin: 8 });
    }
    this.fire.emit({ x, y, z, life: 0.22, size: crit ? 9 : 5, size1: crit ? 14 : 8, color: 0xffd28a, color1: 0xff5010, alpha: 1, alpha1: 0 });
    for (let i = 0; i < 4; i++) {
      this.smoke.emit({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 3, size: 2.5, size1: 9, color: 0x6a645c, color1: 0x3a3632, alpha: 0.7, alpha1: 0, drag: 0.8 });
    }
    if (fire) this.burn(x, y, z, 2);
    this.flash(x, y, z, crit ? 3 : 1.2);
  }

  explosion(x: number, y: number, z: number, big: boolean) {
    const k = big ? 1 : 0.45;
    for (let i = 0; i < 40 * k; i++) {
      const a = Math.random() * 6.28, e = Math.random() * 1.2;
      const s = 10 + Math.random() * 25;
      this.fire.emit({ x, y: y + 2, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 4, vz: Math.sin(a) * Math.cos(e) * s, life: 0.6 + Math.random() * 0.8, size: 6 * k + 3, size1: 14 * k + 4, color: 0xfff0b0, color1: 0xc23a08, alpha: 1, alpha1: 0, drag: 3 });
    }
    for (let i = 0; i < 30 * k; i++) {
      this.smoke.emit({ x: x + (Math.random() - 0.5) * 10, y: y + 2 + Math.random() * 6, z: z + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 8, vy: 4 + Math.random() * 8, vz: (Math.random() - 0.5) * 8, life: 6 + Math.random() * 5, size: 8 * k + 4, size1: 30 * k + 10, color: 0x2a2624, color1: 0x55504a, alpha: 0.85, alpha1: 0, drag: 0.5 });
    }
    for (let i = 0; i < 30 * k; i++) {
      this.spray.emit({ x, y: y + 2, z, vx: (Math.random() - 0.5) * 40, vy: 10 + Math.random() * 25, vz: (Math.random() - 0.5) * 40, life: 2 + Math.random(), size: 0.8 + Math.random(), color: 0x3a2616, alpha: 1, alpha1: 1, gravity: 30, spin: 10 });
    }
    this.flash(x, y, z, big ? 12 : 5);
  }

  burn(x: number, y: number, z: number, intensity = 1) {
    for (let i = 0; i < intensity; i++) {
      this.fire.emit({ x: x + (Math.random() - 0.5) * 2, y, z: z + (Math.random() - 0.5) * 2, vx: (Math.random() - 0.5) * 1.5, vy: 4 + Math.random() * 4, vz: (Math.random() - 0.5) * 1.5, life: 0.7 + Math.random() * 0.5, size: 2.5, size1: 0.8, color: 0xffd070, color1: 0xff3a00, alpha: 0.95, alpha1: 0 });
    }
    if (Math.random() < 0.5 * intensity) {
      this.smoke.emit({ x, y: y + 3, z, vx: 0, vy: 5 + Math.random() * 3, vz: 0, life: 6, size: 3, size1: 18, color: 0x1e1b19, color1: 0x4a4642, alpha: 0.75, alpha1: 0, drag: 0.4 });
    }
  }

  damageSmoke(x: number, y: number, z: number) {
    this.smoke.emit({ x, y, z, vx: 0, vy: 3, vz: 0, life: 5, size: 2, size1: 12, color: 0x3a3632, color1: 0x6a6660, alpha: 0.5, alpha1: 0, drag: 0.4 });
  }

  bowSpray(x: number, y: number, z: number, sideX: number, sideZ: number, power: number) {
    if (Math.random() > power) return;
    for (const s of [1, -1]) {
      this.spray.emit({ x, y, z, vx: sideX * s * (2 + Math.random() * 3), vy: 1.5 + Math.random() * 2.5 * power, vz: sideZ * s * (2 + Math.random() * 3), life: 0.8, size: 1.2, size1: 2.5, color: 0xffffff, color1: 0xdfeaf0, alpha: 0.6, alpha1: 0, gravity: 12 });
    }
  }

  sparkle(x: number, y: number, z: number) {
    this.fire.emit({ x: x + (Math.random() - 0.5) * 4, y: y + Math.random() * 3, z: z + (Math.random() - 0.5) * 4, vy: 1.5, life: 1, size: 1.2, size1: 0.2, color: 0xffe9a0, color1: 0xffb020, alpha: 1, alpha1: 0 });
  }

  // ---------------------------------------------------------------- mise à jour
  update(dt: number, renderT: number, fogColor: THREE.Color, fogDensity: number, wind: THREE.Vector3, light = 1) {
    let n = 0, h = 0;
    for (const b of this.balls) {
      if (b.done) continue;
      const tt = renderT - b.t0;
      if (tt < 0) continue;
      if (!b.flashed) {
        b.flashed = true;
        this.onMuzzle?.(b.x, b.y, b.z, b.owner);
      }
      const x = b.x + b.vx * tt, y = b.y + b.vy * tt - 0.5 * GRAVITY * tt * tt, z = b.z + b.vz * tt;
      if (y < waveHeight(x, z, renderT) - 0.3 || tt > 9) {
        b.done = true;
        if (tt <= 9) { this.splash(x, z, renderT); this.onSplash?.(x, z); }
        continue;
      }
      this.m4.makeTranslation(x, y, z);
      if (b.ammo === 'rouge' && h < 300) this.hotMesh.setMatrixAt(h++, this.m4);
      else if (n < 800) this.ballMesh.setMatrixAt(n++, this.m4);
      if (Math.random() < 0.35) this.smoke.emit({ x, y, z, life: 0.9, size: 0.8, size1: 2.2, color: 0xd8d4cc, alpha: 0.35, alpha1: 0 });
    }
    this.balls = this.balls.filter((b) => !b.done);
    this.ballMesh.count = n;
    this.hotMesh.count = h;
    this.ballMesh.instanceMatrix.needsUpdate = true;
    this.hotMesh.instanceMatrix.needsUpdate = true;

    this.flashT -= dt;
    if (this.flashT <= 0) this.flashLight.intensity *= Math.max(0, 1 - dt * 18);
    for (const p of [this.smoke, this.fire, this.spray]) {
      p.wind.copy(wind);
      p.setFog(fogColor, fogDensity);
      p.uniforms.uLight.value = p === this.fire ? 1 : light;
      p.update(dt);
    }
  }
}

// ---------------------------------------------------------------------------- sillage

const WAKE_VERT = /* glsl */ `
attribute float aAge;
attribute float aSide;
varying float vAge; varying float vSide; varying vec3 vW;
void main(){ vAge = aAge; vSide = aSide; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const WAKE_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uTint; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uCam;
varying float vAge; varying float vSide; varying vec3 vW;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.99,78.23)))*43758.5); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y); }
void main(){
  float edge = 1.0 - abs(vSide);
  float foam = n(vW.xz * 0.9 + uTime * 0.3) * 0.55 + n(vW.xz * 3.1) * 0.45;
  float core = smoothstep(0.0, 0.5, edge);
  float a = (1.0 - vAge) * smoothstep(0.35, 0.8, foam + (1.0 - edge) * 0.35 * (1.0 - vAge)) * (0.4 + 0.6 * core);
  float d = length(vW - uCam);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
  gl_FragColor = vec4(mix(uTint, uFogColor, f), a * 0.55 * (1.0 - f));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class WakeTrail {
  readonly mesh: THREE.Mesh;
  private pts: { x: number; z: number; t: number; w: number; dx: number; dz: number }[] = [];
  private N = 48;
  private pos: Float32Array;
  private age: Float32Array;
  private geo = new THREE.BufferGeometry();
  readonly uniforms: Record<string, THREE.IUniform>;
  private lastT = 0;

  constructor(private width: number) {
    this.pos = new Float32Array(this.N * 2 * 3);
    this.age = new Float32Array(this.N * 2);
    const side = new Float32Array(this.N * 2);
    for (let i = 0; i < this.N; i++) { side[i * 2] = -1; side[i * 2 + 1] = 1; }
    const idx: number[] = [];
    for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAge', new THREE.BufferAttribute(this.age, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    this.geo.setIndex(idx);
    this.uniforms = { uTime: { value: 0 }, uTint: { value: new THREE.Color(0xeef4f6) }, uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0 }, uCam: { value: new THREE.Vector3() } };
    this.mesh = new THREE.Mesh(this.geo, new THREE.ShaderMaterial({ vertexShader: WAKE_VERT, fragmentShader: WAKE_FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  update(t: number, x: number, z: number, h: number, speed: number, cam: THREE.Vector3, camDist: number, fogColor: THREE.Color, fogDensity: number, night: number) {
    const life = 14;
    if (t - this.lastT > 0.25) {
      this.lastT = t;
      this.pts.unshift({ x, z, t, w: Math.min(1, speed / 10), dx: Math.cos(h), dz: -Math.sin(h) });
      if (this.pts.length > this.N) this.pts.pop();
    } else if (this.pts.length) {
      Object.assign(this.pts[0], { x, z, dx: Math.cos(h), dz: -Math.sin(h) });
    }
    const n = this.pts.length;
    for (let i = 0; i < this.N; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      if (!p) break;
      const age = Math.min(1, (t - p.t) / life);
      const w = this.width * (0.45 + age * 1.6) * p.w;
      const y = waveHeight(p.x, p.z, t, camDist) + 0.25;
      this.pos.set([p.x - p.dx * w, y, p.z - p.dz * w, p.x + p.dx * w, y, p.z + p.dz * w], i * 6);
      this.age[i * 2] = this.age[i * 2 + 1] = i >= n - 1 ? 1 : age;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAge.needsUpdate = true;
    this.uniforms.uTime.value = t;
    (this.uniforms.uFogColor.value as THREE.Color).copy(fogColor);
    this.uniforms.uFogDensity.value = fogDensity;
    (this.uniforms.uCam.value as THREE.Vector3).copy(cam);
    (this.uniforms.uTint.value as THREE.Color).setRGB(0.93, 0.96, 0.97).multiplyScalar(0.18 + 0.82 * (1 - night));
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
