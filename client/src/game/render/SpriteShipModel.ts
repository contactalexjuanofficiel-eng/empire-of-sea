// Navire pré-rendu (technique des jeux navals classiques) : le modèle 3D a été « photographié » sous N angles
// dans Blender (tools/ships/sprites.py) avec la même inclinaison que la caméra du jeu. On affiche l'image qui
// correspond au cap du navire vu par la caméra : rendu très net et très léger, même en petit.
import * as THREE from 'three';
import type { ShipDef } from '../../../../shared/ships';

export interface SpriteSheet { file: string; frames: number; cols: number; span: number }

const textures = new Map<string, THREE.Texture>();
function sheetTexture(file: string) {
  let t = textures.get(file);
  if (!t) {
    t = new THREE.TextureLoader().load(`/models/${file}`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    textures.set(file, t);
  }
  return t;
}

export class SpriteShipModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly dims: { L: number; B: number; F: number; draft: number; decks: number; masts: [] };
  readonly firePoints: THREE.Vector3[] = [];
  private sprite: THREE.Sprite;
  private tex: THREE.Texture;
  private frame = -1;
  private rows: number;

  constructor(readonly def: ShipDef, readonly sheet: SpriteSheet) {
    this.tex = sheetTexture(sheet.file).clone();
    this.tex.needsUpdate = true;
    this.rows = Math.ceil(sheet.frames / sheet.cols);
    this.tex.repeat.set(1 / sheet.cols, 1 / this.rows);
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(sheet.span, sheet.span, 1);
    this.sprite.renderOrder = 6; // toujours au-dessus de l'eau (comme une image posée sur la carte)
    this.body.add(this.sprite);
    this.root.add(this.body);
    const L = def.size?.L ?? 30, B = def.size?.B ?? 8;
    this.dims = { L, B, F: 2.6, draft: 3, decks: 0, masts: [] };
    for (const t of [-0.3, 0, 0.3]) this.firePoints.push(new THREE.Vector3(0, 3, t * L));
    this.setView(0);
  }

  /** Cap du navire relatif à l'orientation de la caméra (radians) : choisit l'image à afficher. */
  setView(relHeading: number) {
    const n = this.sheet.frames;
    const k = ((Math.round((relHeading / (Math.PI * 2)) * n) % n) + n) % n;
    if (k === this.frame) return;
    this.frame = k;
    const col = k % this.sheet.cols, row = Math.floor(k / this.sheet.cols);
    this.tex.offset.set(col / this.sheet.cols, 1 - (row + 1) / this.rows);
  }

  update(_t: number, _dt: number, _sail: number, _windRel: number, _ws: number, damage: number) {
    // Navire endommagé : image légèrement assombrie.
    (this.sprite.material as THREE.SpriteMaterial).color.setScalar(1 - Math.min(0.45, damage * 0.45));
  }

  dispose() {
    this.tex.dispose();
    (this.sprite.material as THREE.SpriteMaterial).dispose();
  }
}
