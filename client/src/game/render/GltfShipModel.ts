// Navires modélisés sous Blender et exportés en GLB (vrais modèles 3D : géométrie, matériaux, textures).
// Chaque fichier est chargé une seule fois puis partagé entre tous les navires identiques (géométries et
// matériaux communs) : peu de mémoire et peu d'appels de dessin, adapté au multijoueur.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ShipDef } from '../../../../shared/ships';

const cache = new Map<string, THREE.Group>();
const pending = new Map<string, Promise<THREE.Group>>();
const listeners: (() => void)[] = [];

/** Appelé quand un modèle vient d'arriver : le jeu remplace alors le navire provisoire par le vrai. */
export function onShipAssetLoaded(fn: () => void) { listeners.push(fn); }

export function shipAsset(name: string): THREE.Group | null {
  const g = cache.get(name);
  if (g) return g;
  if (!pending.has(name)) {
    const p = new GLTFLoader().loadAsync(`/models/${name}.glb`).then((gltf) => {
      const scene = gltf.scene as THREE.Group;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        // Voiles et pavillon visibles des deux côtés.
        if (o.name.startsWith('voiles') || mat.name === 'pavillon' || mat.name === 'voile') mat.side = THREE.DoubleSide;
      });
      cache.set(name, scene);
      for (const fn of listeners) fn();
      return scene;
    });
    p.catch((e) => console.warn(`Modèle ${name} introuvable`, e));
    pending.set(name, p);
  }
  return null;
}

export class GltfShipModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly dims: { L: number; B: number; F: number; draft: number; decks: number; masts: [] };
  readonly firePoints: THREE.Vector3[] = [];
  private sails: THREE.Object3D | null = null;

  constructor(readonly def: ShipDef, scene: THREE.Group) {
    const model = scene.clone(true);
    this.body.add(model);
    this.root.add(this.body);
    this.sails = model.getObjectByName('voiles') ?? null;
    const L = def.size?.L ?? 30, B = def.size?.B ?? 8;
    this.dims = { L, B, F: 2.6, draft: 3, decks: 0, masts: [] };
    for (const t of [-0.3, 0, 0.3]) this.firePoints.push(new THREE.Vector3(0, 3, t * L));
  }

  update(t: number, _dt: number, sail: number, _windRel: number, windStrength: number) {
    // Voiles : légère respiration au vent ; carguées (réduites) quand le navire est à l'arrêt.
    if (this.sails) {
      const k = sail > 0 ? 1 : 0.9;
      this.sails.scale.set(1, k, 1 + Math.sin(t * 1.4) * 0.015 * windStrength);
    }
  }

  dispose() { /* géométries et matériaux partagés : rien à libérer par navire */ }
}
