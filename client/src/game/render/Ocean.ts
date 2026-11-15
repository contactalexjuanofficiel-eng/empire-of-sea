// Océan : maillage dense au centre qui suit la caméra, houle de Gerstner, reflets du ciel, soleil,
// écume des crêtes, eaux peu profondes et ressac autour des îles (grâce à une carte des fonds).
import * as THREE from 'three';
import { WAVES_GLSL } from './waves';
import { waterNormalTexture } from './textures';

const VERT = /* glsl */ `
${WAVES_GLSL}
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vCrest;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float d = length(wp.xz - uCamPos.xz);
  vec3 t = vec3(1.0, 0.0, 0.0);
  vec3 b = vec3(0.0, 0.0, 1.0);
  vec3 off = gerstner(wp.xyz, d, t, b);
  wp.xyz += off;
  vNormalW = normalize(cross(b, t));
  vCrest = off.y;
  vWorld = wp.xyz;
  vDist = d;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uWaveScale;
uniform sampler2D uNormalMap;
uniform sampler2D uDepthMap;
uniform float uZoneHalf;
uniform float uNight;
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vCrest;
varying float vDist;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  // Détail de surface : deux couches de normales qui défilent en sens contraires.
  vec2 uv1 = vWorld.xz / 38.0 + vec2(uTime * 0.018, uTime * 0.011);
  vec2 uv2 = vWorld.xz / 13.0 - vec2(uTime * 0.025, -uTime * 0.017);
  vec3 n1 = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;
  float detailFade = 1.0 - smoothstep(200.0, 1800.0, vDist);
  vec3 dn = vec3(n1.x + n2.x, 0.0, n1.y + n2.y) * 0.28 * detailFade * (0.6 + 0.4 * uWaveScale);
  vec3 N = normalize(vNormalW + dn);

  vec3 V = normalize(uCamPos - vWorld);
  float NdV = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);

  // Reflet du ciel (dégradé horizon -> zénith) + soleil.
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(R.y, 0.0, 1.0), 0.45));
  float sunAmt = max(dot(R, uSunDir), 0.0);
  vec3 spec = uSunColor * (pow(sunAmt, 900.0) * 14.0 + pow(sunAmt, 60.0) * 0.45) * step(0.0, uSunDir.y + 0.05);

  // Fond marin : profondeur lue dans la carte de la zone.
  vec2 duv = vWorld.xz / (uZoneHalf * 2.0) + 0.5;
  float terrain = texture2D(uDepthMap, duv).r * 80.0 - 40.0; // altitude du fond (m)
  float depth = clamp(-terrain, 0.0, 40.0);
  float shallow = 1.0 - smoothstep(0.0, 22.0, depth);

  // Couleur de l'eau : diffusion sous la surface plus claire sur les crêtes et face au soleil.
  float sss = pow(max(dot(V, -uSunDir + vec3(0.0, 0.3, 0.0)), 0.0), 3.0) * smoothstep(-0.5, 2.5, vCrest);
  vec3 water = mix(uDeep, uShallow, clamp(shallow * 0.85 + smoothstep(-1.0, 3.5, vCrest) * 0.22, 0.0, 1.0));
  water += uShallow * sss * 0.35 * (1.0 - uNight);
  float diffuse = 0.35 + 0.65 * max(dot(N, uSunDir), 0.0);
  water *= mix(0.45, 1.0, 1.0 - uNight) * diffuse;

  vec3 col = mix(water, sky, fresnel * 0.92) + spec;

  // Écume : crêtes des vagues + ressac sur les rivages.
  float fn = vnoise(vWorld.xz * 0.15 + uTime * 0.2) * 0.6 + vnoise(vWorld.xz * 0.6 - uTime * 0.3) * 0.4;
  float crestFoam = smoothstep(2.2, 4.2, vCrest * (0.6 + 0.5 * uWaveScale)) * smoothstep(0.5, 0.85, fn);
  float shore = (1.0 - smoothstep(0.0, 3.5, depth)) * step(-1.0, -terrain + 0.0);
  float shoreFoam = shore * smoothstep(0.25, 0.7, fn + 0.35 * sin(depth * 2.5 - uTime * 2.0));
  float foam = clamp(crestFoam * 0.9 + shoreFoam, 0.0, 1.0);
  vec3 foamCol = mix(vec3(0.9, 0.93, 0.95), uSunColor * 0.6 + uSkyHorizon * 0.5, 0.3) * mix(0.2, 1.0, 1.0 - uNight);
  col = mix(col, foamCol, foam * detailFade);

  // Brouillard.
  float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Ocean {
  readonly mesh: THREE.Mesh;
  readonly uniforms: Record<string, THREE.IUniform>;
  private spacing: number;

  constructor() {
    // Grille non uniforme : très dense près de la caméra, de plus en plus lâche jusqu'à l'horizon.
    const N = 400;
    const EXTENT = 14000;
    const A = 0.0214;
    const geo = new THREE.PlaneGeometry(2, 2, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const remap = (u: number) => Math.sign(u) * (A * Math.abs(u) + (1 - A) * Math.pow(Math.abs(u), 4)) * EXTENT;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, remap(pos.getX(i)));
      pos.setZ(i, remap(pos.getZ(i)));
    }
    geo.computeBoundingSphere();
    geo.boundingSphere!.radius = EXTENT * 2;
    this.spacing = A * (2 / N) * EXTENT;

    this.uniforms = {
      uTime: { value: 0 },
      uWaveScale: { value: 1 },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uSkyZenith: { value: new THREE.Color(0.25, 0.45, 0.7) },
      uSkyHorizon: { value: new THREE.Color(0.7, 0.78, 0.85) },
      uDeep: { value: new THREE.Color(0x0b2a3a) },
      uShallow: { value: new THREE.Color(0x2f6f73) },
      uFogColor: { value: new THREE.Color(0.7, 0.78, 0.85) },
      uFogDensity: { value: 0.0003 },
      uNormalMap: { value: waterNormalTexture() },
      uDepthMap: { value: null },
      uZoneHalf: { value: 4000 },
      uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  follow(cam: THREE.Vector3) {
    const s = Math.max(1, this.spacing);
    this.mesh.position.set(Math.round(cam.x / s) * s, 0, Math.round(cam.z / s) * s);
    (this.uniforms.uCamPos.value as THREE.Vector3).copy(cam);
  }

  setDepthMap(tex: THREE.Texture, half: number) {
    this.uniforms.uDepthMap.value = tex;
    this.uniforms.uZoneHalf.value = half;
  }
}
