// Ciel, soleil, lune, étoiles, nuages, brouillard, pluie et éclairs ; génère aussi la carte d'environnement
// (reflets sur les coques, dorures et canons).
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

const C = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const PAL = {
  zenith: { day: C(0.16, 0.36, 0.68), dusk: C(0.22, 0.24, 0.42), night: C(0.025, 0.045, 0.1) },
  horizon: { day: C(0.66, 0.76, 0.86), dusk: C(0.98, 0.58, 0.34), night: C(0.07, 0.1, 0.16) },
  sun: { day: C(1.0, 0.95, 0.86), dusk: C(1.0, 0.55, 0.26), night: C(0.32, 0.42, 0.62) },
};

function blend(p: { day: THREE.Color; dusk: THREE.Color; night: THREE.Color }, e: number, out: THREE.Color) {
  // e = élévation du soleil (-1..1)
  if (e > 0.25) return out.copy(p.day);
  if (e > 0.02) return out.copy(p.dusk).lerp(p.day, (e - 0.02) / 0.23);
  if (e > -0.12) return out.copy(p.night).lerp(p.dusk, (e + 0.12) / 0.14);
  return out.copy(p.night);
}

const CLOUD_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const CLOUD_FRAG = /* glsl */ `
uniform float uTime; uniform float uCover; uniform vec3 uLit; uniform vec3 uShade; uniform vec3 uCam; uniform vec2 uWind; uniform vec3 uFog;
varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec2 p = vW.xz * 0.00035 + uWind * uTime * 0.004;
  float d = fbm(p);
  float a = smoothstep(1.0 - uCover, 1.0 - uCover + 0.35, d);
  float dist = length(vW.xz - uCam.xz);
  a *= 1.0 - smoothstep(9000.0, 15000.0, dist);
  vec3 col = mix(uLit, uShade, smoothstep(0.4, 0.95, d));
  col = mix(col, uFog, smoothstep(4000.0, 14000.0, dist));
  gl_FragColor = vec4(col, a * 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const DOME_FRAG = /* glsl */ `
uniform vec3 uFog; uniform float uAmount;
varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, 0.0, 1.0);
  float a = (1.0 - smoothstep(0.0, 0.35 + 0.5 * uAmount, h)) * uAmount;
  gl_FragColor = vec4(uFog, clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
`;

export class SkyEnv {
  readonly sky = new Sky();
  readonly sun = new THREE.DirectionalLight(0xffffff, 3);
  readonly hemi = new THREE.HemisphereLight(0x8899aa, 0x0b2030, 0.8);
  readonly sunDir = new THREE.Vector3(0, 1, 0);
  readonly zenith = new THREE.Color();
  readonly horizon = new THREE.Color();
  readonly sunColor = new THREE.Color();
  readonly fogColor = new THREE.Color();
  night = 0;
  daylight = 1;
  private stars: THREE.Points;
  private clouds: THREE.Mesh;
  private dome: THREE.Mesh;
  private rain: THREE.LineSegments;
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private lastEnvSun = new THREE.Vector3(9, 9, 9);
  private lastEnvTime = -99; // reflets du ciel recalculés au plus toutes les 8 s
  private lightning = 0;
  onThunder: ((delay: number) => void) | null = null;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.sky.scale.setScalar(20000);
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    const u = this.sky.material.uniforms;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.82;

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 10; sc.far = 1400;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target, this.hemi);

    // Étoiles
    const sg = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 2200; i++) {
      const th = Math.random() * Math.PI * 2, y = Math.random() * 0.95 + 0.03;
      const r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(th) * r * 15000, y * 15000, Math.sin(th) * r * 15000);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Nuages
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(32000, 32000).rotateX(Math.PI / 2),
      new THREE.ShaderMaterial({
        vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uCover: { value: 0.4 }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() }, uCam: { value: new THREE.Vector3() }, uWind: { value: new THREE.Vector2(1, 0) }, uFog: { value: new THREE.Color() } },
      }),
    );
    this.clouds.position.y = 1600;
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = -2;
    scene.add(this.clouds);

    // Dôme de brume (masque l'horizon quand le brouillard tombe)
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(10000, 32, 16),
      new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, transparent: true, depthWrite: false, depthTest: true, side: THREE.BackSide, uniforms: { uFog: { value: new THREE.Color() }, uAmount: { value: 0 } } }),
    );
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    // Pluie
    const N = 5000;
    const rp = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = (Math.random() - 0.5) * 240, y = Math.random() * 120, z = (Math.random() - 0.5) * 240;
      rp.set([x, y, z, x + 0.3, y - 3.5, z], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb2c4, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);

    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  /**
   * @param day fraction de journée (0 = minuit, 0,5 = midi)
   * @param fog facteur de brouillard (1 = normal)
   * @param storm intensité de tempête 0..1
   */
  update(t: number, dt: number, day: number, baseFog: number, fog: number, storm: number, turbidity: number, cam: THREE.Vector3, focus: THREE.Vector3, wind: { dir: number; strength: number }) {
    const ang = (day - 0.25) * Math.PI * 2;
    const elev = Math.sin(ang) * 0.82 + 0.1;
    this.sunDir.set(Math.cos(ang) * 0.9, elev, 0.42).normalize();
    const e = this.sunDir.y;
    this.night = THREE.MathUtils.clamp((0.05 - e) / 0.17, 0, 1);
    this.daylight = 1 - this.night;

    blend(PAL.zenith, e, this.zenith);
    blend(PAL.horizon, e, this.horizon);
    blend(PAL.sun, e, this.sunColor);
    // Brume et tempête : ciel plus gris et plus sombre.
    const grey = THREE.MathUtils.clamp((fog - 1) * 0.35 + storm * 0.75, 0, 0.9);
    const lum = (0.3 * this.horizon.r + 0.59 * this.horizon.g + 0.11 * this.horizon.b);
    const g = C(lum, lum * 1.02, lum * 1.05);
    this.horizon.lerp(g, grey);
    this.zenith.lerp(g.multiplyScalar(0.8), grey);
    const dark = 1 - storm * 0.5;
    this.horizon.multiplyScalar(dark);
    this.zenith.multiplyScalar(dark);
    this.fogColor.copy(this.horizon);

    // Éclairs
    if (storm > 0.5 && Math.random() < dt * 0.12 * storm) {
      this.lightning = 1;
      this.onThunder?.(0.3 + Math.random() * 2.5);
    }
    this.lightning = Math.max(0, this.lightning - dt * 4);
    const flash = this.lightning > 0 ? (Math.random() < 0.6 ? this.lightning : 0) : 0;

    // Ciel de Preetham
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    u.turbidity.value = turbidity + storm * 8 + (fog - 1) * 3;
    u.rayleigh.value = THREE.MathUtils.lerp(2.4, 3.4, 1 - Math.min(1, Math.max(0, e * 3))) * (1 - storm * 0.6);

    // Lumières
    const sunUp = Math.max(0, e);
    this.sun.position.copy(focus).addScaledVector(e > -0.05 ? this.sunDir : new THREE.Vector3(-this.sunDir.x, 0.6, -this.sunDir.z).normalize(), 600);
    this.sun.target.position.copy(focus);
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = (e > -0.05 ? 0.4 + 3.2 * Math.min(1, sunUp * 3) : 0.9) * (1 - storm * 0.55) * (1 - grey * 0.4) + flash * 4;
    this.hemi.color.copy(this.zenith).lerp(C(1, 1, 1), 0.25);
    this.hemi.groundColor.set(0x0d2230).multiplyScalar(this.daylight * 0.8 + 0.2);
    this.hemi.intensity = 0.7 + 0.6 * this.daylight + flash * 3;

    // Brouillard de la scène
    const sceneFog = this.scene.fog as THREE.FogExp2;
    sceneFog.color.copy(this.fogColor);
    if (flash) sceneFog.color.lerp(C(0.8, 0.85, 1), flash * 0.5);
    sceneFog.density = baseFog * fog * (1 + storm * 0.8);

    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (1 - grey) * (1 - storm);
    this.stars.position.copy(cam);

    const cu = (this.clouds.material as THREE.ShaderMaterial).uniforms;
    cu.uTime.value = t;
    cu.uCover.value = 0.3 + storm * 0.6 + (fog - 1) * 0.12;
    cu.uLit.value.copy(this.sunColor).multiplyScalar(0.25 + 0.75 * this.daylight).lerp(this.horizon, 0.35).multiplyScalar(1 - storm * 0.45);
    cu.uShade.value.copy(this.zenith).lerp(C(0.3, 0.32, 0.36), 0.5).multiplyScalar(0.35 + 0.5 * this.daylight).multiplyScalar(1 - storm * 0.5);
    cu.uCam.value.copy(cam);
    cu.uWind.value.set(Math.sin(wind.dir), Math.cos(wind.dir));
    cu.uFog.value.copy(this.fogColor);
    this.clouds.position.x = cam.x;
    this.clouds.position.z = cam.z;

    const du = (this.dome.material as THREE.ShaderMaterial).uniforms;
    du.uFog.value.copy(this.fogColor);
    du.uAmount.value = THREE.MathUtils.clamp((fog - 1) * 0.45 + storm * 0.6, 0, 0.97);
    this.dome.position.copy(cam);

    // Pluie qui suit la caméra
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity = storm * 0.55;
    this.rain.visible = storm > 0.02;
    if (this.rain.visible) {
      const fall = (t * 70) % 120;
      this.rain.position.set(cam.x, cam.y - 40 - fall, cam.z);
    }

    // Carte d'environnement (reflets) : régénérée quand le soleil a bougé.
    if (this.lastEnvSun.distanceTo(this.sunDir) > 0.08 && t - this.lastEnvTime > 8) {
      this.lastEnvSun.copy(this.sunDir);
      this.lastEnvTime = t;
      const eu = this.envSky.material.uniforms;
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) eu[k].value = u[k].value;
      eu.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0.02);
      this.scene.environment = this.envRT.texture;
      old?.dispose();
    }
    this.scene.environmentIntensity = 0.25 + 0.75 * this.daylight * (1 - storm * 0.5);
    return flash;
  }
}
