// Caméra à la troisième personne : derrière et au-dessus du navire, rotation libre à la souris, zoom à la molette,
// retour automatique derrière la poupe, jamais sous l'eau.
import * as THREE from 'three';
import { waveHeight } from './render/waves';

export class CameraRig {
  yaw = Math.PI; // angle autour du navire (PI = derrière)
  pitch = 0.32;
  dist = 90;
  private targetYaw = Math.PI;
  private targetPitch = 0.32;
  private targetDist = 90;
  private focus = new THREE.Vector3();
  private lastManual = -99;
  autoFollow = true;
  minDist = 30;
  maxDist = 420;
  shake = 0;
  /** « dessus » : vue plongeante nord en haut (par défaut) ; « 3d » : derrière le navire. */
  mode: 'dessus' | '3d' = 'dessus';
  readonly pan = new THREE.Vector3();
  private topDist = 760;
  /** Vue aérienne : orientation (0 = nord en haut) et inclinaison (≈ 55°, façon isométrique). */
  isoYaw = 0;
  private isoYawTarget = 0;
  readonly isoPitch = 0.92; // ≈ 53° : vue oblique façon L7S — mer, îles et navires vus de trois-quarts

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  setMode(m: 'dessus' | '3d') {
    this.mode = m;
    this.pan.set(0, 0, 0);
    this.camera.fov = m === 'dessus' ? 30 : 55;
    this.camera.updateProjectionMatrix();
  }

  /** Déplace la vue (vue du dessus) : touches caméra ou clic droit glissé. */
  panBy(sx: number, sz: number) {
    // Le glissement est exprimé dans le repère de l'écran : on le tourne selon l'orientation de la caméra.
    const c = Math.cos(this.isoYaw), si = Math.sin(this.isoYaw);
    const dx = sx * c + sz * si, dz = -sx * si + sz * c;
    this.pan.x = THREE.MathUtils.clamp(this.pan.x + dx, -1500, 1500);
    this.pan.z = THREE.MathUtils.clamp(this.pan.z + dz, -1500, 1500);
  }
  center() { this.pan.set(0, 0, 0); this.isoYawTarget = 0; }
  /** Rotation de la vue aérienne (touches ou clic molette glissé). */
  rotateIso(d: number) { this.isoYawTarget += d; }
  get viewDist() { return this.mode === 'dessus' ? this.topDist : this.dist; }

  rotate(dx: number, dy: number, t: number) {
    this.targetYaw -= dx * 0.005;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.004, 0.04, 1.35);
    this.lastManual = t;
  }

  zoom(delta: number) {
    if (this.mode === 'dessus') { this.topDist = THREE.MathUtils.clamp(this.topDist * Math.exp(delta * 0.0012), 300, 1600); return; }
    this.targetDist = THREE.MathUtils.clamp(this.targetDist * Math.exp(delta * 0.0012), this.minDist, this.maxDist);
  }

  setShip(length: number) {
    this.minDist = length * 0.9 + 12;
    this.maxDist = Math.max(420, length * 6);
    this.targetDist = THREE.MathUtils.clamp(length * 2.6 + 20, this.minDist, this.maxDist);
  }

  /** Cinématique (écran titre, port) : orbite lente autour d'un point. */
  orbit(center: THREE.Vector3, t: number, radius: number, height: number) {
    const a = t * 0.06;
    this.camera.position.set(center.x + Math.sin(a) * radius, center.y + height, center.z + Math.cos(a) * radius);
    this.camera.lookAt(center.x, center.y + height * 0.25, center.z);
  }

  update(dt: number, t: number, target: THREE.Vector3, heading: number, aimMode: boolean) {
    if (this.mode === 'dessus') {
      // Vue aérienne inclinée (façon isométrique) : on voit le navire, une grande partie de l'océan et le relief.
      this.isoYaw += (this.isoYawTarget - this.isoYaw) * (1 - Math.exp(-dt * 8));
      const k = 1 - Math.exp(-dt * 10);
      this.focus.x += (target.x + this.pan.x - this.focus.x) * k;
      this.focus.z += (target.z + this.pan.z - this.focus.z) * k;
      this.focus.y = 0;
      // Focale serrée : moins de déformation, rendu proche d'une vue isométrique.
      if (this.camera.fov !== 30) { this.camera.fov = 30; this.camera.updateProjectionMatrix(); }
      const pitch = this.isoPitch, cp = Math.cos(pitch);
      const pos = this.camera.position;
      pos.set(this.focus.x + Math.sin(this.isoYaw) * cp * this.topDist, Math.sin(pitch) * this.topDist, this.focus.z + Math.cos(this.isoYaw) * cp * this.topDist);
      if (this.shake > 0) {
        pos.x += (Math.random() - 0.5) * this.shake;
        pos.z += (Math.random() - 0.5) * this.shake;
        this.shake = Math.max(0, this.shake - dt * 3);
      }
      this.camera.lookAt(this.focus.x, this.focus.y, this.focus.z);
      this.yaw = this.isoYaw;
      return;
    }
    if (this.autoFollow && !aimMode && t - this.lastManual > 4) {
      // Revient doucement derrière le navire.
      const behind = heading + Math.PI;
      const diff = Math.atan2(Math.sin(behind - this.targetYaw - 0), Math.cos(behind - this.targetYaw));
      this.targetYaw += diff * Math.min(1, dt * 0.6);
    }
    const k = 1 - Math.exp(-dt * 8);
    this.yaw += Math.atan2(Math.sin(this.targetYaw - this.yaw), Math.cos(this.targetYaw - this.yaw)) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
    this.dist += (this.targetDist - this.dist) * k;
    this.focus.copy(target); // le navire est déjà lissé par la prédiction

    const cp = Math.cos(this.pitch);
    const pos = this.camera.position;
    pos.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.dist,
      this.focus.y + Math.sin(this.pitch) * this.dist + 6,
      this.focus.z + Math.cos(this.yaw) * cp * this.dist,
    );
    const minY = waveHeight(pos.x, pos.z, t) + 3;
    if (pos.y < minY) pos.y = minY;
    if (this.shake > 0) {
      pos.x += (Math.random() - 0.5) * this.shake;
      pos.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    this.camera.lookAt(this.focus.x, this.focus.y + 6 + this.dist * 0.04, this.focus.z);
  }
}
