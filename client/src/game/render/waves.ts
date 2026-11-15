// Houle de Gerstner : la même formule sert au shader de l'océan (GPU) et au tangage des navires (CPU).

export interface Wave { dx: number; dz: number; len: number; steep: number }

export const WAVES: Wave[] = [
  { dx: 0.96, dz: 0.28, len: 140, steep: 0.11 },
  { dx: 0.31, dz: 0.95, len: 78, steep: 0.1 },
  { dx: -0.6, dz: 0.8, len: 41, steep: 0.085 },
  { dx: 0.8, dz: -0.6, len: 23, steep: 0.07 },
  { dx: -0.2, dz: -0.98, len: 13, steep: 0.05 },
];

/** Intensité courante de la houle (zone × tempête), modifiée par le jeu. */
export const seaState = { scale: 1 };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Hauteur approximative de l'eau en (x, z) au temps t (on néglige le déplacement horizontal).
 *  `camDist` reproduit l'atténuation des petites vagues au loin faite par le shader. */
export function waveHeight(x: number, z: number, t: number, camDist = 0): number {
  let y = 0;
  const s = seaState.scale;
  for (const w of WAVES) {
    const fade = 1 - smooth(w.len * 5, w.len * 12, camDist);
    if (fade <= 0) continue;
    const k = (2 * Math.PI) / w.len;
    const c = Math.sqrt(9.8 / k);
    const a = (w.steep * s * fade) / k;
    y += a * Math.sin(k * (w.dx * x + w.dz * z - c * t));
  }
  return y;
}

export const WAVES_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWaveScale;
uniform vec3 uCamPos;
const int NWAVES = ${WAVES.length};
const vec4 WAVE_DEF[NWAVES] = vec4[NWAVES](
${WAVES.map((w) => `  vec4(${w.dx.toFixed(3)}, ${w.dz.toFixed(3)}, ${w.len.toFixed(2)}, ${w.steep.toFixed(3)})`).join(',\n')}
);
vec3 gerstner(vec3 p, float dist, inout vec3 tangent, inout vec3 binormal) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < NWAVES; i++) {
    vec4 w = WAVE_DEF[i];
    float fade = 1.0 - smoothstep(w.z * 5.0, w.z * 12.0, dist);
    float k = 6.28318 / w.z;
    float c = sqrt(9.8 / k);
    vec2 d = normalize(w.xy);
    float steep = w.w * uWaveScale * fade;
    float a = steep / k;
    float f = k * (dot(d, p.xz) - c * uTime);
    float cf = cos(f), sf = sin(f);
    o.x += d.x * a * cf;
    o.y += a * sf;
    o.z += d.y * a * cf;
    tangent += vec3(-d.x * d.x * steep * sf, d.x * steep * cf, -d.x * d.y * steep * sf);
    binormal += vec3(-d.x * d.y * steep * sf, d.y * steep * cf, -d.y * d.y * steep * sf);
  }
  return o;
}
`;
