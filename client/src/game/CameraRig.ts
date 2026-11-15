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

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  rotate(dx: number, dy: number, t: number) {
    this.targetYaw -= dx * 0.005;
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.004, 0.04, 1.35);
    this.lastManual = t;
  }

  zoom(delta: number) {
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
