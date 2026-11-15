// Moteur client : rendu Three.js, prédiction du navire du joueur, interpolation des autres entités,
// visée et tir, effets, étiquettes et liaison avec l'interface React.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AMMO, AMMO_ORDER, CONSUMABLE_ORDER, type AmmoId, type ConsumableId } from '../../../shared/items';
import { clamp, fmt, wrapAngle } from '../../../shared/math';
import { collideShip, GRAVITY, stepShip, type ShipKinematics, type Wind } from '../../../shared/physics';
import { F_BURNING, F_PVP, F_REPAIRING, F_SAFE, F_SINKING, type EntityMeta, type GameEvent, type MeState, type S2C, type Side, type WeatherState } from '../../../shared/protocol';
import { computeStats, SHIP_BY_ID, type ShipStats } from '../../../shared/ships';
import { DOCK_RADIUS, FACTION_LABEL, START_ZONE, ZONE_BY_ID, type ZoneDef } from '../../../shared/zones';
import { terrainHeight } from '../../../shared/world';
import { Connection } from '../net/Connection';
import { notify, pushChat, saveSettings, store } from '../store';
import { GameAudio } from './Audio';
import { CameraRig } from './CameraRig';
import { Input, type Action } from './Input';
import { Effects, WakeTrail } from './render/Effects';
import { Ocean } from './render/Ocean';
import { ShipModel } from './render/ShipModel';
import { MonsterModel } from './render/MonsterModel';
import { playerBonus } from '../../../shared/extras';
import { GRADES } from '../../../shared/ranks';
import { SkyEnv } from './render/SkyEnv';
import { buildZoneVisual, type ZoneVisual } from './render/WorldBuilder';
import { seaState, waveHeight } from './render/waves';

const INTERP = 0.12; // délai d'interpolation (s)
const ARC = 0.6; // demi-angle de tir des sabords (rad), identique au serveur

interface Snap { t: number; x: number; z: number; h: number; speed: number; hp: number; flags: number; sail: number; sailHp: number }
interface ClientEnt {
  id: number;
  meta: EntityMeta;
  snaps: Snap[];
  cur: Snap;
  seen: number;
  model?: ShipModel | MonsterModel;
  wake?: WakeTrail;
  obj?: THREE.Object3D;
  label?: HTMLDivElement;
  hpBar?: HTMLElement;
  sinkT: number;
  pose: { heave: number; pitch: number; roll: number };
  fxT: number;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.5, 24000);
  readonly net = new Connection();
  readonly audio = new GameAudio();
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private sky: SkyEnv;
  private ocean = new Ocean(store.get().settings.quality === 'haute' ? 320 : store.get().settings.quality === 'moyenne' ? 220 : 140);
  private fx = new Effects();
  private rig: CameraRig;
  readonly input: Input;
  private zoneVis: ZoneVisual | null = null;
  zone: ZoneDef = ZONE_BY_ID[START_ZONE];
  private ents = new Map<number, ClientEnt>();
  private metas = new Map<number, EntityMeta>();
  private evQueue: { t: number; ev: GameEvent }[] = [];
  myId = 0;
  private me: MeState | null = null;
  private pred: ShipKinematics | null = null;
  private myStats: ShipStats | null = null;
  private sail = 1;
  private rudder = 0;
  private seq = 0;
  private lastSent = { sail: 1, rudder: 0, t: 0 };
  private manual = false;
  private manualUntil = 0;
  private wind: Wind = { dir: 0.5, strength: 0.85 };
  private weather: WeatherState = { kind: 'clair', intensity: 0, fog: 1 };
  private day = 0.71;
  private dayTarget = 0.71;
  private serverOffset: number | null = null;
  private rtt = 0.08;
  private clock = new THREE.Clock();
  t = 0;
  private dockModel: ShipModel | null = null;
  private bobber: THREE.Group | null = null;
  private dockModelKey = '';
  private showcase: ShipModel | null = null;
  private showcaseKey = '';
  private aim = { x: 0, z: 0, side: null as Side | null, inArc: false, dist: 0 };
  private aimRing: THREE.Mesh;
  private aimLine: THREE.Line;
  private fans: THREE.Group;
  private fanMats: THREE.MeshBasicMaterial[] = [];
  private labelsEl: HTMLDivElement;
  private worldLabels: { el: HTMLDivElement; x: number; y: number; z: number; kind: string }[] = [];
  private hudTimer = 0;
  private pingTimer = 0;
  private lastCannon = new Map<number, number>();
  private raycaster = new THREE.Raycaster();
  private tmpV = new THREE.Vector3();
  private loadingZone = false;
  private navRing!: THREE.Mesh;
  private targetRing!: THREE.Mesh;
  selectedId = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private slowStreak = 0;
  /** Aperçu visuel : ?heure=0.5 (midi) ou 0.74 (coucher de soleil) force l'heure affichée. */
  private forcedDay = (() => { const v = Number(new URLSearchParams(location.search).get('heure')); return Number.isFinite(v) && v > 0 && v < 1 ? v : null; })();

  constructor(private container: HTMLElement, overlay: HTMLDivElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.labelsEl = overlay;

    this.scene.fog = new THREE.FogExp2(0x9fb0c0, 0.0003);
    this.sky = new SkyEnv(this.scene, this.renderer);
    this.sky.onThunder = (d) => this.audio.thunder(d);
    this.scene.add(this.ocean.mesh, this.fx.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.5, 3.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.rig = new CameraRig(this.camera);
    this.input = new Input(this.renderer.domElement, store.get().settings.keys);
    this.input.onDrag = (dx, dy) => {
      if (this.rig.mode === 'dessus') this.rig.panBy(-dx * this.rig.viewDist * 0.0025, -dy * this.rig.viewDist * 0.0035);
      else this.rig.rotate(dx, dy, this.t);
    };
    this.input.onWheel = (d) => this.rig.zoom(d);
    this.input.onClick = (x, y) => this.click(x, y);
    this.input.on((a) => this.action(a));

    // Indicateurs de visée
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(5, 7, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf0c25a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    const lg = new THREE.BufferGeometry().setFromPoints(new Array(40).fill(0).map(() => new THREE.Vector3()));
    this.aimLine = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0xf0c25a, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.8, depthWrite: false }));
    this.aimLine.frustumCulled = false;
    this.fans = new THREE.Group();
    for (const start of [-0.6, Math.PI - 0.6]) {
      const m = new THREE.MeshBasicMaterial({ color: 0xf0c25a, transparent: true, opacity: 0.03, depthWrite: false, side: THREE.DoubleSide, fog: false });
      this.fanMats.push(m);
      const fan = new THREE.Mesh(new THREE.RingGeometry(0.12, 1, 32, 1, start, 1.2).rotateX(-Math.PI / 2), m);
      const pts: THREE.Vector3[] = [];
      pts.push(new THREE.Vector3(Math.cos(start) * 0.12, 0, -Math.sin(start) * 0.12));
      for (let i = 0; i <= 24; i++) { const a = start + (i / 24) * 1.2; pts.push(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a))); }
      pts.push(new THREE.Vector3(Math.cos(start + 1.2) * 0.12, 0, -Math.sin(start + 1.2) * 0.12));
      const lm = new THREE.LineBasicMaterial({ color: 0xf0c25a, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
      const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm);
      fan.userData.outline = lm;
      this.fans.add(fan, outline);
    }
    this.fans.renderOrder = 4;
    this.scene.add(this.aimRing, this.aimLine, this.fans);
    // Repères : destination (vert) et cible (rouge)
    this.navRing = new THREE.Mesh(new THREE.RingGeometry(6, 8.5, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5dff8a, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    this.targetRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.12, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    this.navRing.renderOrder = this.targetRing.renderOrder = 5;
    this.scene.add(this.navRing, this.targetRing);

    this.fx.onMuzzle = (x, y, z, owner) => this.muzzle(x, y, z, owner);
    this.fx.onSplash = (x, z) => this.audio.splash(this.camera.position.distanceTo(this.tmpV.set(x, 0, z)));

    this.net.on((m) => this.onMessage(m));
    this.net.onState = (s) => store.set({ connection: s });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applySettings();
    this.loadZone(START_ZONE);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------------ réglages
  applySettings() {
    const s = store.get().settings;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(s.quality === 'haute' ? dpr : s.quality === 'moyenne' ? 1 : 0.75);
    this.ocean.setResolution(s.quality === 'haute' ? 320 : s.quality === 'moyenne' ? 220 : 140);
    this.renderer.shadowMap.enabled = s.quality !== 'basse';
    this.sky.sun.castShadow = s.quality !== 'basse';
    this.sky.sun.shadow.mapSize.setScalar(s.quality === 'haute' ? 2048 : 1024);
    this.sky.sun.shadow.map?.dispose();
    (this.sky.sun.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    this.bloom.enabled = s.quality === 'haute';
    this.rig.autoFollow = s.autoCam;
    this.input.setKeys(s.keys);
    if (this.rig.mode !== s.camMode) this.rig.setMode(s.camMode);
    this.audio.setVolume(s.volume, s.muted);
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
  }

  // ------------------------------------------------------------------ zones
  loadZone(id: string) {
    const def = ZONE_BY_ID[id] ?? ZONE_BY_ID[START_ZONE];
    if (this.zoneVis && this.zone.id === def.id) return;
    this.loadingZone = true;
    if (this.zoneVis) {
      this.scene.remove(this.zoneVis.group);
      this.zoneVis.dispose();
    }
    for (const l of this.worldLabels) l.el.remove();
    this.worldLabels = [];
    this.zone = def;
    this.zoneVis = buildZoneVisual(def);
    this.scene.add(this.zoneVis.group);
    this.ocean.setDepthMap(this.zoneVis.depthTex, def.half);
    (this.ocean.uniforms.uDeep.value as THREE.Color).set(def.ambiance.deep);
    (this.ocean.uniforms.uShallow.value as THREE.Color).set(def.ambiance.shallow);
    for (const l of this.zoneVis.labels) {
      const el = document.createElement('div');
      el.className = `wlabel wlabel-${l.kind}`;
      el.textContent = l.text;
      this.labelsEl.appendChild(el);
      this.worldLabels.push({ el, x: l.x, y: l.y, z: l.z, kind: l.kind });
    }
    this.loadingZone = false;
  }

  minimapImage() { return this.zoneVis?.minimap ?? null; }

  private clearEntities() {
    for (const e of this.ents.values()) this.removeEnt(e);
    this.ents.clear();
    this.metas.clear();
    this.evQueue = [];
    this.serverOffset = null;
    this.pred = null;
  }

  // ------------------------------------------------------------------ réseau
  private serverNow() {
    return performance.now() / 1000 + (this.serverOffset ?? 0);
  }

  private onMessage(m: S2C) {
    switch (m.t) {
      case 'need_create':
        store.set({ screen: 'create', name: m.name });
        break;
      case 'welcome':
        this.clearEntities();
        this.myId = m.id;
        store.set({ screen: 'loading', name: m.name, profile: m.profile, zone: m.zone, port: m.port, docked: true, panel: 'port', portTab: 'capitainerie' });
        setTimeout(() => {
          this.loadZone(m.zone);
          store.set({ screen: 'game' });
        }, 30);
        break;
      case 'zone':
        this.clearEntities();
        this.myId = m.id;
        store.set({ screen: 'loading', zone: m.zone, port: m.port, docked: true });
        setTimeout(() => {
          this.loadZone(m.zone);
          store.set({ screen: 'game', panel: 'port' });
        }, 30);
        break;
      case 'profile':
        store.set({ profile: m.p, port: m.p.port });
        if (this.myStats && !this.me?.docked) this.refreshMyStats();
        break;
      case 'port':
        store.set({ portData: { offers: m.offers, prices: m.prices }, port: m.port });
        break;
      case 'meta':
        for (const meta of m.list) {
          this.metas.set(meta.id, meta);
          const e = this.ents.get(meta.id);
          if (e) { e.meta = meta; this.refreshLabel(e, true); }
        }
        break;
      case 'snap':
        this.onSnap(m);
        break;
      case 'chat':
        pushChat({ ch: m.ch, from: m.from, text: m.text, tag: m.tag });
        break;
      case 'notice':
        notify(m.text, m.kind);
        if (m.kind === 'gain') this.audio.coins();
        if (m.kind === 'level') this.audio.bell();
        break;
      case 'err':
        notify(m.text, 'warn');
        break;
      case 'guild':
        store.set({ guild: m.info });
        break;
      case 'group':
        store.set({ group: { members: m.members, leader: m.leader, invite: m.invite } });
        if (m.invite) notify(`${m.invite} vous invite dans son groupe. Ouvrez la Guilde pour accepter.`, 'event');
        break;
      case 'boss':
        store.set((s) => ({ boss: { ...s.boss, ...m } }));
        break;
      case 'maps':
        store.set({ maps: m.list });
        break;
      case 'grade':
        store.set({ grade: { grade: m.grade, points: m.points, next: m.next, prev: m.prev, counts: m.counts, position: m.position } });
        break;
      case 'pong':
        this.rtt = clamp(performance.now() / 1000 - m.c, 0.005, 2);
        store.set({ ping: Math.round(this.rtt * 1000) });
        break;
    }
  }

  private onSnap(m: Extract<S2C, { t: 'snap' }>) {
    const local = performance.now() / 1000;
    const off = m.st - local;
    if (this.serverOffset === null || Math.abs(off - this.serverOffset) > 1) this.serverOffset = off;
    else if (off > this.serverOffset) this.serverOffset = off;
    else this.serverOffset += (off - this.serverOffset) * 0.02;

    this.wind = m.wind;
    this.weather = m.wx;
    this.dayTarget = m.day;
    const wasDocked = this.me?.docked ?? true;
    this.me = m.me;
    if (wasDocked !== m.me.docked) {
      store.set({ docked: m.me.docked, panel: m.me.docked ? 'port' : null });
      if (!m.me.docked) {
        this.pred = null;
        this.sail = 1;
        this.refreshMyStats();
      }
    }
    const present = new Set<number>();
    for (const s of m.e) {
      const [id, x, z, h, speed, hp, flags, sail, sailHp] = s;
      present.add(id);
      let e = this.ents.get(id);
      const snap: Snap = { t: m.st, x, z, h, speed, hp: hp / 1000, flags, sail, sailHp: sailHp / 1000 };
      if (!e) {
        const meta = this.metas.get(id);
        if (!meta) continue;
        e = this.createEnt(id, meta, snap);
        this.ents.set(id, e);
      }
      e.snaps.push(snap);
      if (e.snaps.length > 30) e.snaps.shift();
      e.seen = m.st;
      if (id === this.myId) this.reconcile(snap);
    }
    for (const e of [...this.ents.values()]) {
      if (!present.has(e.id) && m.st - e.seen > 0.6) {
        this.removeEnt(e);
        this.ents.delete(e.id);
      }
    }
    for (const ev of m.ev) this.evQueue.push({ t: m.st, ev });
  }

  private refreshMyStats() {
    const p = store.get().profile;
    if (!p) return;
    const s = p.ships.find((x) => x.uid === p.active) ?? p.ships[0];
    if (!s) return;
    this.myStats = computeStats(SHIP_BY_ID[s.def], s.up, p.skills, s.fit, playerBonus(p).stat);
    this.rig.setShip(this.myStats.length);
  }

  /** Corrige en douceur la prédiction locale avec l'état faisant autorité. */
  private reconcile(s: Snap) {
    if (!this.myStats || s.flags & F_SINKING) { this.pred = null; return; }
    const ext: ShipKinematics = { x: s.x, z: s.z, h: s.h, speed: s.speed };
    const lag = clamp(this.rtt / 2, 0, 0.4);
    if (lag > 0.01) stepShip(ext, this.myStats, { sail: this.sail, rudder: this.rudder }, this.wind, lag, { sailRatio: s.sailHp });
    if (!this.pred) { this.pred = ext; return; }
    const ex = ext.x - this.pred.x, ez = ext.z - this.pred.z;
    if (ex * ex + ez * ez > 35 * 35) { this.pred = ext; return; }
    this.pred.x += ex * 0.12;
    this.pred.z += ez * 0.12;
    this.pred.h += wrapAngle(ext.h - this.pred.h) * 0.15;
    this.pred.speed += (ext.speed - this.pred.speed) * 0.2;
  }

  // ------------------------------------------------------------------ entités
  private createEnt(id: number, meta: EntityMeta, snap: Snap): ClientEnt {
    const e: ClientEnt = { id, meta, snaps: [], cur: { ...snap }, seen: snap.t, sinkT: snap.flags & F_SINKING ? 5 : -1, pose: { heave: 0, pitch: 0, roll: 0 }, fxT: 0 };
    if (meta.kind === 'player' || meta.kind === 'npc' || meta.kind === 'boss') {
      const def = SHIP_BY_ID[meta.ship ?? 'bayonnaise'];
      e.model = def.look.monster ? new MonsterModel(def) : new ShipModel(def, meta.kind === 'player' ? meta.flag : undefined, meta.skin);
      e.model.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
      this.scene.add(e.model.root);
      e.wake = new WakeTrail(def ? e.model.dims.B * 0.55 : 4);
      this.scene.add(e.wake.mesh);
      if (meta.kind === 'boss') {
        const l = new THREE.PointLight(0x3dffb0, 4000, 300, 1.5);
        l.position.set(0, 30, 0);
        e.model.body.add(l);
      }
    } else if (meta.kind === 'loot') {
      e.obj = meta.loot === 'coffre' ? this.makeChest() : this.makeLoot(meta.loot === 'tresor');
      this.scene.add(e.obj);
    }
    if (id !== this.myId && meta.kind !== 'fort') {
      e.label = document.createElement('div');
      e.label.className = 'elabel';
      this.labelsEl.appendChild(e.label);
      this.refreshLabel(e, true);
    }
    if (meta.kind === 'fort' && meta.faction === 'pirate') {
      e.label = document.createElement('div');
      e.label.className = 'elabel';
      this.labelsEl.appendChild(e.label);
      this.refreshLabel(e, true);
    }
    return e;
  }

  /** Coffre flottant : petit coffre cerclé de fer qui scintille. */
  private makeChest() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: 0.75 });
    const iron = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3, emissive: 0x4a3200, emissiveIntensity: 0.5 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 1.8), wood);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wood);
    lid.position.y = 0.8;
    for (const x of [-0.9, 0.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 1.9), iron); b.position.set(x, 0.4, 0); g.add(b); }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.2), iron);
    lock.position.set(0, 0.5, 0.95);
    g.add(box, lid, lock);
    g.scale.setScalar(1.6);
    g.userData.treasure = true;
    return g;
  }

  private makeLoot(treasure: boolean) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: treasure ? 0x5a3a1c : 0x7a5a3a, roughness: 0.8 });
    if (treasure) {
      const chest = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2), wood);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), wood);
      lid.position.y = 1;
      const goldM = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.25, emissive: 0x8a5a00, emissiveIntensity: 0.6 });
      const band = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 2.1), goldM);
      band.position.y = 0.6;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 120, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      pillar.position.y = 60;
      g.add(chest, lid, band, pillar);
      g.userData.treasure = true;
    } else {
      for (let i = 0; i < 4; i++) {
        const b = i < 2 ? new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), wood) : new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), wood);
        b.position.set((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5);
        b.rotation.set(Math.random(), Math.random() * 3, Math.random());
        g.add(b);
      }
    }
    return g;
  }

  private removeEnt(e: ClientEnt) {
    if (e.model) { this.scene.remove(e.model.root); e.model.dispose(); }
    if (e.wake) { this.scene.remove(e.wake.mesh); e.wake.dispose(); }
    if (e.obj) this.scene.remove(e.obj);
    e.label?.remove();
  }

  private relation(meta: EntityMeta): { hostile: boolean; friend: boolean } {
    if (meta.kind === 'npc' || meta.kind === 'boss') return { hostile: true, friend: false };
    if (meta.kind === 'fort') return { hostile: meta.faction === 'pirate', friend: meta.faction === 'france' };
    if (meta.kind === 'player') return { hostile: false, friend: !!meta.friend };
    return { hostile: false, friend: false };
  }

  private refreshLabel(e: ClientEnt, full: boolean) {
    if (!e.label) return;
    const m = e.meta;
    if (full) {
      e.label.innerHTML = '';
      const name = document.createElement('div');
      name.className = 'n';
      const lvl = document.createElement('span');
      lvl.className = 'lv';
      lvl.textContent = m.kind === 'loot' ? '' : m.kind === 'fort' ? '⚑' : String(m.level);
      if (m.kind === 'player') {
        const gr = GRADES[m.grade ?? GRADES.length - 1];
        const lys = document.createElement('span');
        lys.className = `grade-lys metal-${gr.metal}`;
        lys.textContent = '⚜';
        lys.title = gr.name;
        name.insertBefore(lys, name.firstChild);
        if (m.shootRank) {
          const r = document.createElement('span');
          r.className = 'rank-badge';
          r.textContent = `⛨${m.shootRank}`;
          r.title = `Rang de bataille ${m.shootRank}`;
          name.appendChild(r);
        }
      }
      const txt = document.createElement('span');
      if (m.kind === 'player') txt.textContent = `${m.tag ? `[${m.tag}] ` : ''}${m.name}`;
      else if (m.kind === 'npc') txt.textContent = m.faction === 'monstre' ? `${m.name} (Monstre)` : `${m.name} · ${FACTION_LABEL[m.faction]} (PNJ)`;
      else if (m.kind === 'boss') txt.textContent = `☠ ${m.name} (BOSS)`;
      else txt.textContent = m.name;
      if (m.kind !== 'loot') name.appendChild(lvl);
      name.appendChild(txt);
      e.label.appendChild(name);
      if (m.kind !== 'loot') {
        const bar = document.createElement('div');
        bar.className = 'hb';
        const fill = document.createElement('i');
        bar.appendChild(fill);
        e.label.appendChild(bar);
        e.hpBar = fill;
      }
      const r = this.relation(m);
      e.label.dataset.kind = m.kind;
      e.label.dataset.rel = r.friend ? 'ami' : r.hostile ? 'ennemi' : 'neutre';
    }
  }

  // ------------------------------------------------------------------ actions
  sendCreate(portrait: number, flag: 'royal' | 'tricolore' | 'imperial', ship: string) {
    this.net.send({ t: 'create', portrait, flag, ship });
  }

  private action(a: Action) {
    const s = store.get();
    if (s.screen !== 'game') return;
    this.audio.unlock();
    if (a === 'escape') { store.set({ panel: s.panel ? (s.docked ? 'port' : null) : 'parametres' }); return; }
    if (a === 'chat') { store.set({ chatFocus: Date.now() }); return; }
    if (a === 'maps') { store.set({ panel: s.panel === 'carte' ? (s.docked ? 'port' : null) : 'carte' }); return; }
    if (a === 'camMode') { const m = s.settings.camMode === 'dessus' ? '3d' : 'dessus'; saveSettings({ ...s.settings, camMode: m }); this.applySettings(); return; }
    if (a === 'camCenter') { this.rig.center(); return; }
    if (a === 'missions' || a === 'shop' || a === 'captains') {
      const panel = a === 'shop' ? 'boutique' : a === 'captains' ? 'capitaines' : 'missions';
      store.set({ panel: s.panel === panel ? (s.docked ? 'port' : null) : panel });
      return;
    }
    if (a === 'inventory') { store.set({ panel: s.panel === 'inventaire' ? (s.docked ? 'port' : null) : 'inventaire' }); return; }
    if (a === 'profile') { store.set({ panel: s.panel === 'profil' ? (s.docked ? 'port' : null) : 'profil' }); return; }
    if (a === 'ranking') { store.set({ panel: s.panel === 'classement' ? (s.docked ? 'port' : null) : 'classement' }); return; }
    if (a === 'guild') { store.set({ panel: s.panel === 'guilde' ? (s.docked ? 'port' : null) : 'guilde' }); return; }
    if (s.docked || !this.me) return;
    switch (a) {
      case 'sailUp': this.sail = Math.min(3, this.sail + 1); break;
      case 'sailDown': this.sail = Math.max(0, this.sail - 1); break;
      case 'fireBoth': this.fire(); break;
      case 'hot1': case 'hot2': case 'hot3': case 'hot4': case 'hot5': case 'hot6': case 'hot7': case 'hot8': case 'hot9': case 'hot10': this.hotbar(Number(a.slice(3))); break;
      case 'fish': this.net.send({ t: 'fish', on: !this.me.fishing }); break;
      case 'attack': if (this.selectedId) this.attack(this.selectedId); else notify('Cliquez d\'abord sur un navire ennemi pour le cibler.', 'warn'); break;
      case 'cancelAttack': this.cancelAttack(); break;
      case 'dock': this.dock(); break;
      case 'pvp': this.net.send({ t: 'pvp', on: !this.me.pvp }); break;
    }
  }

  attack(id: number) {
    this.selectedId = id;
    this.net.send({ t: 'target', id, attack: true });
  }
  cancelAttack() {
    this.net.send({ t: 'target', id: 0, attack: false });
    this.selectedId = 0;
  }

  /** Clic gauche : sur un navire = cibler (et attaquer), sur la mer = naviguer jusque-là. */
  private click(x: number, y: number) {
    this.audio.unlock();
    const s = store.get();
    if (s.docked || !this.pred || !this.me || this.me.dead > 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    // 1) un navire (ou un fort pirate) sous le curseur ?
    let best: ClientEnt | null = null, bd = Infinity;
    const p = new THREE.Vector3();
    for (const e of this.ents.values()) {
      if (e.id === this.myId || e.cur.flags & F_SINKING) continue;
      const k = e.meta.kind;
      if (k !== 'npc' && k !== 'boss' && k !== 'player' && !(k === 'fort' && e.meta.faction === 'pirate')) continue;
      const r = e.model ? Math.max(14, e.model.dims.L * 0.55) : 24;
      p.set(e.cur.x, e.model ? e.model.dims.F + 4 : 10, e.cur.z);
      const d = ray.distanceToPoint(p);
      if (d < r && d < bd) { bd = d; best = e; }
    }
    if (best) {
      const rel = this.relation(best.meta);
      const pvp = best.meta.kind === 'player' && (this.zone.pvp === 'libre' || (this.me.pvp && !!(best.cur.flags & F_PVP)));
      this.selectedId = best.id;
      if ((rel.hostile || pvp) && s.settings.autoAttack) this.attack(best.id);
      else this.net.send({ t: 'target', id: best.id, attack: false });
      return;
    }
    // 2) sinon, la mer. En vue 3D : salve vers le point visé. En vue du dessus : navigation.
    if (this.rig.mode === '3d') { this.fire(); return; }
    if (ray.direction.y >= -0.001) return;
    const t = -ray.origin.y / ray.direction.y;
    let tx = ray.origin.x + ray.direction.x * t, tz = ray.origin.z + ray.direction.z * t;
    if (this.zoneVis && terrainHeight(this.zoneVis.world, tx, tz) > -4) {
      for (let i = 0; i < 60; i++) {
        tx += (this.pred.x - tx) * 0.05;
        tz += (this.pred.z - tz) * 0.05;
        if (terrainHeight(this.zoneVis.world, tx, tz) < -6) break;
      }
    }
    const lim = this.zone.half - 80;
    this.net.send({ t: 'move', x: Math.round(clamp(tx, -lim, lim)), z: Math.round(clamp(tz, -lim, lim)) });
    this.navRing.userData.pulse = 1;
  }

  selectAmmo(id: AmmoId) { this.net.send({ t: 'ammo', id }); }
  useItem(id: ConsumableId) { this.net.send({ t: 'use', id }); }
  setSail(level: number) { this.sail = clamp(level, 0, 3); }
  dock() { this.net.send({ t: 'dock' }); }
  undock() { this.net.send({ t: 'undock' }); store.set({ panel: null }); }

  /** Salve vers la cible sélectionnée, sinon vers le point visé : les canons tirent dans toutes les directions. */
  fire() {
    if (!this.pred) return;
    const t = this.me?.target ? this.ents.get(this.me.target) : this.selectedId ? this.ents.get(this.selectedId) : undefined;
    let x = this.aim.x, z = this.aim.z;
    if (t) { x = t.cur.x; z = t.cur.z; }
    else if (!this.aim.side) return;
    this.net.send({ t: 'fire', side: 'both', x: Math.round(x), z: Math.round(z) });
  }

  /** Barre rapide : 1 à 7 munitions, 8 à 10 les trois premiers objets possédés. */
  hotbar(n: number) {
    if (n <= 7) { this.selectAmmo(AMMO_ORDER[n - 1]); return; }
    const p = store.get().profile;
    if (!p) return;
    const owned = CONSUMABLE_ORDER.filter((id) => (p.items[id] ?? 0) > 0);
    const id = owned[n - 8];
    if (id) this.useItem(id);
  }

  private muzzle(x: number, y: number, z: number, owner: number) {
    const e = this.ents.get(owner);
    let dx = 0, dz = 0;
    if (e) {
      const ox = owner === this.myId && this.pred ? this.pred.x : e.cur.x;
      const oz = owner === this.myId && this.pred ? this.pred.z : e.cur.z;
      const l = Math.hypot(x - ox, z - oz) || 1;
      dx = (x - ox) / l; dz = (z - oz) / l;
    }
    this.fx.muzzle(x, y, z, dx, dz, e?.meta.kind === 'boss' ? 1.6 : 1);
    const now = this.t;
    if ((this.lastCannon.get(owner) ?? -1) < now - 0.12) {
      this.lastCannon.set(owner, now);
      this.audio.cannon(this.camera.position.distanceTo(this.tmpV.set(x, y, z)));
    }
    if (owner === this.myId) this.rig.shake = Math.max(this.rig.shake, 0.6);
  }

  // ------------------------------------------------------------------ événements
  private processEvents(renderT: number) {
    while (this.evQueue.length && this.evQueue[0].t <= renderT + 0.02) {
      const { ev } = this.evQueue.shift()!;
      switch (ev.k) {
        case 'shot':
          ev.balls.forEach((b, i) => this.fx.addBall(ev.pid + i, ev.id, ev.t + b.d, b, ev.ammo));
          break;
        case 'hit': {
          this.fx.removeBall(ev.pid);
          this.fx.hit(ev.x, ev.y, ev.z, !!ev.fire, !!ev.crit);
          const d = this.camera.position.distanceTo(this.tmpV.set(ev.x, ev.y, ev.z));
          this.audio.impact(d);
          if (ev.by === this.myId || ev.id === this.myId) this.floatText(ev.x, ev.y + 4, ev.z, `${ev.id === this.myId ? '−' : ''}${fmt(ev.dmg)}${ev.crit ? ' !' : ''}`, ev.id === this.myId ? 'dmg-me' : ev.crit ? 'dmg-crit' : 'dmg');
          if (ev.id === this.myId) this.rig.shake = Math.max(this.rig.shake, 1.2);
          break;
        }
        case 'splash':
          this.fx.removeBall(ev.pid);
          break;
        case 'sink': {
          const e = this.ents.get(ev.id);
          if (e) e.sinkT = 0;
          break;
        }
        case 'boom': {
          const y = Math.max(0, this.zoneVis ? 0 : 0);
          this.fx.explosion(ev.x, y + 2, ev.z, !!ev.big);
          this.audio.explosion(this.camera.position.distanceTo(this.tmpV.set(ev.x, 0, ev.z)), !!ev.big);
          if (ev.big && this.camera.position.distanceTo(this.tmpV) < 300) this.rig.shake = 2;
          break;
        }
        case 'loot':
          if (ev.by === this.myId) this.audio.coins();
          break;
      }
    }
  }

  private floatText(x: number, y: number, z: number, text: string, cls: string) {
    const v = this.tmpV.set(x, y, z).project(this.camera);
    if (v.z > 1) return;
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${(v.x * 0.5 + 0.5) * this.labelsEl.clientWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * this.labelsEl.clientHeight}px`;
    this.labelsEl.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ------------------------------------------------------------------ boucle
  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    const s = store.get();
    const inGame = s.screen === 'game' && !this.loadingZone;
    const renderT = this.serverNow() - INTERP;

    // Ciel, météo, heure
    let dd = this.dayTarget - this.day;
    if (dd > 0.5) dd -= 1;
    if (dd < -0.5) dd += 1;
    this.day = (this.day + dd * Math.min(1, dt * 0.5) + 1) % 1;
    if (this.forcedDay !== null && inGame) this.day = this.forcedDay;
    if (!inGame) this.day = 0.738 + Math.sin(this.t * 0.02) * 0.004; // coucher de soleil sur l'écran titre
    const storm = inGame && this.weather.kind === 'tempete' ? this.weather.intensity : 0;
    seaState.scale = this.zone.ambiance.waves * (1 + storm * 0.75);
    this.ocean.uniforms.uWaveScale.value = seaState.scale;

    let focus = new THREE.Vector3();
    let heading = 0;
    if (inGame) {
      if (this.me && !this.me.docked) this.updateInput(dt);
      this.processEvents(renderT);
      this.updateEntities(dt, renderT);
      const mine = this.ents.get(this.myId);
      if (this.me?.docked || !mine) {
        this.updateDock();
        const dm = this.dockModel;
        if (dm) {
          focus.copy(dm.root.position);
          this.rig.orbit(focus, this.t, dm.dims.L * 1.6 + 30, dm.dims.L * 0.45 + 10);
        }
        const W = this.renderer.domElement.clientWidth, H = this.renderer.domElement.clientHeight;
        if (s.panel === 'port' && W > 1100) this.camera.setViewOffset(W, H, W * 0.26, 0, W, H);
        else this.camera.clearViewOffset();
      } else {
        this.camera.clearViewOffset();
        this.removeDockModel();
        const p = this.pred ?? { x: mine.cur.x, z: mine.cur.z, h: mine.cur.h };
        focus.set(p.x, 0, p.z);
        heading = p.h;
        if (this.rig.mode === 'dessus') {
          const sp = this.rig.viewDist * 1.2 * dt, h = this.input.held;
          this.rig.panBy((h.has('camRight') ? sp : 0) - (h.has('camLeft') ? sp : 0), (h.has('camDown') ? sp : 0) - (h.has('camUp') ? sp : 0));
        }
        this.rig.update(dt, this.t, focus, heading, this.input.dragging);
      }
      this.updateAim();
    } else {
      this.removeDockModel();
      this.camera.clearViewOffset();
      this.updateShowcase(dt);
      focus.copy(this.showcase!.root.position);
      this.rig.orbit(focus, this.t + 40, this.showcase!.dims.L * 1.7 + 25, this.showcase!.dims.L * 0.35 + 6);
      this.aimRing.visible = this.aimLine.visible = this.fans.visible = false;
    }

    const flash = this.sky.update(this.t, dt, this.day, this.zone.ambiance.fog * (inGame ? 1 : 0.6), inGame ? this.weather.fog : 1, storm, inGame ? this.zone.ambiance.turbidity : 2.2, this.camera.position, focus, this.wind);
    const fog = this.scene.fog as THREE.FogExp2;
    const ou = this.ocean.uniforms;
    ou.uTime.value = this.t;
    (ou.uSunDir.value as THREE.Vector3).copy(this.sky.sunDir);
    (ou.uSunColor.value as THREE.Color).copy(this.sky.sunColor).multiplyScalar(this.sky.daylight * (1 - storm * 0.7) + (this.sky.sunDir.y < 0 ? 0.15 : 0));
    (ou.uSkyZenith.value as THREE.Color).copy(this.sky.zenith);
    (ou.uSkyHorizon.value as THREE.Color).copy(this.sky.horizon);
    (ou.uFogColor.value as THREE.Color).copy(fog.color);
    ou.uFogDensity.value = fog.density;
    ou.uNight.value = this.sky.night;
    this.ocean.follow(this.camera.position);
    this.renderer.toneMappingExposure = 0.48 + this.sky.night * 0.4 + flash * 0.4;

    // Phares et fenêtres la nuit
    if (this.zoneVis) {
      for (const lh of this.zoneVis.lighthouses) {
        lh.beam.rotation.y = this.t * 0.6;
        (lh.beam.material as THREE.MeshBasicMaterial).opacity = this.sky.night * 0.12 + (this.weather.fog - 1) * 0.03 * this.sky.night;
        lh.lamp.emissiveIntensity = 0.5 + this.sky.night * 6;
      }
      for (const w of this.zoneVis.windows) w.emissiveIntensity = this.sky.night * 1.6;
    }

    const windVec = new THREE.Vector3(Math.sin(this.wind.dir), 0, Math.cos(this.wind.dir)).multiplyScalar(4 + this.wind.strength * 4);
    this.fx.update(dt, renderT, fog.color, fog.density, windVec, 0.22 + 0.78 * this.sky.daylight * (1 - storm * 0.4));
    this.updateLabels();
    this.audio.ambience(this.t, this.pred?.speed ?? 0, this.wind.strength, storm);

    this.hudTimer -= dt;
    if (inGame && this.hudTimer <= 0) { this.hudTimer = 0.1; this.pushHud(); }
    this.pingTimer -= dt;
    if (inGame && this.pingTimer <= 0) { this.pingTimer = 2; this.net.send({ t: 'ping', c: performance.now() / 1000 }); }

    this.composer.render(dt);
    this.measureFps();
  }

  /** Compte les images par seconde et baisse la qualité si l'ordinateur peine. */
  private measureFps() {
    this.fpsFrames++;
    const now = performance.now();
    if (!this.fpsTime) this.fpsTime = now;
    if (now - this.fpsTime < 2000) return;
    const fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsTime));
    this.fpsFrames = 0;
    this.fpsTime = now;
    store.set({ fps });
    const st = store.get().settings;
    if (fps < 28 && st.quality !== 'basse' && !document.hidden) {
      if (++this.slowStreak >= 2) {
        this.slowStreak = 0;
        const next = st.quality === 'haute' ? 'moyenne' : 'basse';
        saveSettings({ ...st, quality: next });
        this.applySettings();
        notify(`Qualité graphique abaissée automatiquement (${next}) pour plus de fluidité. Modifiable dans Paramètres.`, 'info');
      }
    } else this.slowStreak = 0;
  }

  private updateInput(dt: number) {
    const s = store.get();
    const typing = s.chatFocus && document.activeElement?.tagName === 'INPUT';
    let target = 0;
    if (!typing) {
      if (this.input.held.has('left')) target -= 1;
      if (this.input.held.has('right')) target += 1;
    }
    this.rudder += clamp(target - this.rudder, -dt * 2.5, dt * 2.5);
    if (Math.abs(this.rudder) < 0.02 && target === 0) this.rudder = 0;
    const r = Math.round(this.rudder * 20) / 20;
    const keyboard = target !== 0 || this.sail !== this.lastSent.sail || (r !== this.lastSent.rudder && this.manual);
    if (keyboard && (r !== this.lastSent.rudder || this.sail !== this.lastSent.sail || this.t - this.lastSent.t > 0.5)) {
      this.manual = true;
      this.manualUntil = this.t + 0.6;
      this.net.send({ t: 'input', sail: this.sail, rudder: r, seq: ++this.seq });
      this.lastSent = { sail: this.sail, rudder: r, t: this.t };
    }
    // Pilote automatique (clic sur la mer ou attaque) : on prédit avec la barre décidée par le serveur.
    if (this.me?.auto && this.t > this.manualUntil) {
      this.manual = false;
      this.sail = this.me.helm[0];
      this.rudder = this.me.helm[1];
      this.lastSent = { sail: this.sail, rudder: Math.round(this.rudder * 20) / 20, t: this.t };
    }
    if (this.pred && this.myStats) {
      const mine = this.ents.get(this.myId);
      stepShip(this.pred, this.myStats, { sail: this.sail, rudder: this.rudder }, this.wind, dt, { sailRatio: mine?.cur.sailHp ?? 1 });
      if (this.zoneVis) collideShip(this.pred, this.myStats, this.zoneVis.world, this.zone.half);
    }
  }

  private interp(e: ClientEnt, renderT: number) {
    const sn = e.snaps;
    if (!sn.length) return;
    let a = sn[0], b = sn[sn.length - 1];
    for (let i = 0; i < sn.length - 1; i++) {
      if (sn[i].t <= renderT && sn[i + 1].t >= renderT) { a = sn[i]; b = sn[i + 1]; break; }
    }
    const c = e.cur;
    if (renderT >= b.t) {
      const ex = clamp(renderT - b.t, 0, 0.3);
      c.x = b.x + Math.sin(b.h) * b.speed * ex;
      c.z = b.z + Math.cos(b.h) * b.speed * ex;
      c.h = b.h;
    } else if (renderT <= a.t) {
      c.x = a.x; c.z = a.z; c.h = a.h;
    } else {
      const k = (renderT - a.t) / Math.max(0.001, b.t - a.t);
      c.x = a.x + (b.x - a.x) * k;
      c.z = a.z + (b.z - a.z) * k;
      c.h = a.h + wrapAngle(b.h - a.h) * k;
    }
    const last = sn[sn.length - 1];
    c.speed = last.speed; c.hp = last.hp; c.flags = last.flags; c.sail = last.sail; c.sailHp = last.sailHp;
  }

  private updateEntities(dt: number, renderT: number) {
    const camD = (x: number, z: number) => Math.hypot(this.camera.position.x - x, this.camera.position.z - z);
    for (const e of this.ents.values()) {
      this.interp(e, renderT);
      const c = e.cur;
      if (e.id === this.myId && this.pred) {
        c.x = this.pred.x; c.z = this.pred.z; c.h = this.pred.h; c.speed = this.pred.speed; c.sail = this.sail;
        const last = e.snaps[e.snaps.length - 1];
        if (last) { c.hp = last.hp; c.flags = last.flags; c.sailHp = last.sailHp; }
      }
      if (e.model) {
        const m = e.model;
        const { L, B } = m.dims;
        const cd = camD(c.x, c.z);
        const fx = Math.sin(c.h), fz = Math.cos(c.h), px = Math.cos(c.h), pz = -Math.sin(c.h);
        const hb = waveHeight(c.x + fx * L * 0.4, c.z + fz * L * 0.4, this.t, cd);
        const hs = waveHeight(c.x - fx * L * 0.4, c.z - fz * L * 0.4, this.t, cd);
        const hp_ = waveHeight(c.x + px * B * 0.5, c.z + pz * B * 0.5, this.t, cd);
        const hsb = waveHeight(c.x - px * B * 0.5, c.z - pz * B * 0.5, this.t, cd);
        const k = 1 - Math.exp(-dt * 4);
        const maxSp = SHIP_BY_ID[e.meta.ship ?? '']?.cls ? 18 : 18;
        const rud = e.id === this.myId ? this.rudder : clamp(wrapAngle((e.snaps.at(-2)?.h ?? c.h) - c.h) * 8, -1, 1);
        const list = c.hp < 0.3 ? (0.3 - c.hp) * 0.3 : 0;
        e.pose.heave += ((hb + hs + hp_ + hsb) / 4 - e.pose.heave) * k;
        e.pose.pitch += (-Math.atan2(hb - hs, L * 0.8) - e.pose.pitch) * k;
        e.pose.roll += (Math.atan2(hp_ - hsb, B) - rud * (c.speed / maxSp) * 0.07 + list - e.pose.roll) * k;
        let y = e.pose.heave * 0.85 - 0.2;
        let pitch = e.pose.pitch, roll = e.pose.roll;
        if (c.flags & F_SINKING) {
          if (e.sinkT < 0) e.sinkT = 0;
          e.sinkT += dt;
          const s2 = e.sinkT;
          y -= s2 * s2 * 0.55;
          pitch -= Math.min(0.5, s2 * 0.06);
          roll += Math.min(0.6, s2 * 0.07);
        }
        m.root.position.set(c.x, 0, c.z);
        m.root.rotation.y = c.h;
        m.body.position.y = y;
        m.body.rotation.set(pitch, 0, roll);
        const windRel = wrapAngle(c.h - this.wind.dir);
        m.update(this.t, dt, c.flags & F_SINKING ? 0 : c.sail, windRel, this.wind.strength, 1 - c.hp, 1 - c.sailHp, this.sky.night);
        m.root.visible = cd < 6000;

        // Effets : incendie, fumée de dégâts, gerbes d'étrave
        e.fxT -= dt;
        if (e.fxT <= 0 && cd < 2200) {
          e.fxT = 0.06;
          m.body.updateWorldMatrix(true, false);
          if (c.flags & F_BURNING || (c.flags & F_SINKING && e.sinkT < 6)) {
            for (const fp of m.firePoints) {
              if (Math.random() < 0.5) continue;
              const w = fp.clone();
              m.body.localToWorld(w);
              this.fx.burn(w.x, w.y, w.z, 1);
            }
          } else if (c.hp < 0.5 && Math.random() < (0.6 - c.hp)) {
            const fp = m.firePoints[Math.floor(Math.random() * m.firePoints.length)].clone();
            m.body.localToWorld(fp);
            this.fx.damageSmoke(fp.x, fp.y, fp.z);
          }
          if (c.speed > 6 && !(c.flags & F_SINKING)) {
            const bow = new THREE.Vector3(0, 0.5, L * 0.5);
            m.body.localToWorld(bow);
            this.fx.bowSpray(bow.x, waveHeight(bow.x, bow.z, this.t, cd) + 0.4, bow.z, px, pz, Math.min(1, (c.speed - 6) / 10));
          }
          if (e.meta.kind === 'boss') this.fx.sparkle(c.x + (Math.random() - 0.5) * L, 10 + Math.random() * 20, c.z + (Math.random() - 0.5) * L);
        }
        if (e.wake) {
          const stern = this.tmpV.set(c.x - Math.sin(c.h) * L * 0.42, 0, c.z - Math.cos(c.h) * L * 0.42);
          e.wake.update(this.t, stern.x, stern.z, c.h, c.flags & F_SINKING ? 0 : c.speed, this.camera.position, cd, (this.scene.fog as THREE.FogExp2).color, (this.scene.fog as THREE.FogExp2).density, this.sky.night);
          e.wake.mesh.visible = cd < 2500;
        }
      } else if (e.obj) {
        const y = waveHeight(c.x, c.z, this.t) - 0.3;
        e.obj.position.set(c.x, y, c.z);
        e.obj.rotation.y = this.t * 0.2;
        e.obj.rotation.z = Math.sin(this.t * 1.3 + c.x) * 0.12;
        if (e.obj.userData.treasure && Math.random() < 0.3) this.fx.sparkle(c.x, y + 1, c.z);
      }
    }
  }

  private updateDock() {
    const s = store.get();
    const p = s.profile;
    if (!p || !this.zoneVis) return;
    const portId = s.port ?? p.port;
    const dock = this.zoneVis.world.docks[portId];
    if (!dock) return;
    const shipId = s.panel === 'port' && s.portTab === 'chantier' && s.preview ? s.preview : (p.ships.find((x) => x.uid === p.active)?.def ?? 'bayonnaise');
    const key = `${shipId}:${p.flag}:${portId}:${p.skin}`;
    if (this.dockModelKey !== key) {
      this.removeDockModel();
      this.dockModel = new ShipModel(SHIP_BY_ID[shipId] ?? SHIP_BY_ID.bayonnaise, p.flag, p.skin);
      this.dockModelKey = key;
      this.scene.add(this.dockModel.root);
    }
    const m = this.dockModel!;
    m.root.position.set(dock.x, 0, dock.z);
    m.root.rotation.y = dock.h + Math.PI / 2;
    m.body.position.y = waveHeight(dock.x, dock.z, this.t) * 0.6 - 0.2;
    m.body.rotation.set(Math.sin(this.t * 0.5) * 0.01, 0, Math.sin(this.t * 0.7) * 0.02);
    m.update(this.t, 0.016, s.portTab === 'chantier' ? 3 : 1, 1.5, this.wind.strength, 0, 0, this.sky.night);
  }
  private removeDockModel() {
    if (!this.dockModel) return;
    this.scene.remove(this.dockModel.root);
    this.dockModel.dispose();
    this.dockModel = null;
    this.dockModelKey = '';
  }

  private updateShowcase(dt: number) {
    const s = store.get();
    const id = s.screen === 'create' ? s.preview : 'soleil_royal';
    if (this.showcaseKey !== id) {
      if (this.showcase) { this.scene.remove(this.showcase.root); this.showcase.dispose(); }
      this.showcase = new ShipModel(SHIP_BY_ID[id] ?? SHIP_BY_ID.soleil_royal);
      this.showcaseKey = id;
      this.scene.add(this.showcase.root);
    }
    const m = this.showcase!;
    const dock = this.zoneVis?.world.docks.brest;
    const x = (dock?.x ?? 0) + 260, z = (dock?.z ?? 0) - 120;
    const h = 2.2 + this.t * 0.01;
    m.root.position.set(x, 0, z);
    m.root.rotation.y = h;
    const L = m.dims.L;
    const hb = waveHeight(x + Math.sin(h) * L * 0.4, z + Math.cos(h) * L * 0.4, this.t);
    const hs = waveHeight(x - Math.sin(h) * L * 0.4, z - Math.cos(h) * L * 0.4, this.t);
    m.body.position.y = (hb + hs) / 2 - 0.2;
    m.body.rotation.set(-Math.atan2(hb - hs, L * 0.8), 0, Math.sin(this.t * 0.6) * 0.03);
    m.update(this.t, dt, 3, 2.0, 0.9, 0, 0, this.sky.night);
  }

  private updateAim() {
    const s = store.get();
    const show = !s.docked && !!this.pred && !!this.myStats && !(this.me && this.me.dead > 0) && !s.panel;
    this.updateMarkers(show);
    this.aimRing.visible = this.aimLine.visible = show && this.rig.mode === '3d';
    this.fans.visible = false;
    if (!show || !this.pred || !this.myStats || !this.me) { this.aim.side = null; return; }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((this.input.mouseX - rect.left) / rect.width) * 2 - 1, -((this.input.mouseY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    const p = this.pred;
    const range = this.myStats.range * AMMO[this.me.ammo].range;
    let ax: number, az: number;
    if (ray.direction.y < -0.001) {
      const tt = -ray.origin.y / ray.direction.y;
      ax = ray.origin.x + ray.direction.x * tt;
      az = ray.origin.z + ray.direction.z * tt;
    } else {
      ax = ray.origin.x + ray.direction.x * 5000;
      az = ray.origin.z + ray.direction.z * 5000;
    }
    const bearing = Math.atan2(ax - p.x, az - p.z);
    const rel = wrapAngle(bearing - p.h);
    const side: Side = rel > 0 ? 'babord' : 'tribord';
    const center = side === 'babord' ? Math.PI / 2 : -Math.PI / 2;
    const off = wrapAngle(rel - center);
    const inArc = Math.abs(off) <= ARC;
    const yaw = p.h + center + clamp(off, -ARC, ARC);
    const dist = clamp(Math.hypot(ax - p.x, az - p.z), 40, range);
    this.aim = { x: p.x + Math.sin(yaw) * dist, z: p.z + Math.cos(yaw) * dist, side, inArc, dist };
    const idx = side === 'babord' ? 0 : 1;
    const lum = 0.15 + 0.85 * this.sky.daylight;
    const ready = this.me.reload[idx] <= 0.05;
    const col = !ready ? 0xd0402a : inArc ? 0xf0c25a : 0xb89a5a;
    (this.aimRing.material as THREE.MeshBasicMaterial).color.setHex(col);
    (this.aimRing.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * lum;
    (this.aimLine.material as THREE.LineDashedMaterial).color.setHex(col);
    this.aimRing.position.set(this.aim.x, waveHeight(this.aim.x, this.aim.z, this.t) + 0.6, this.aim.z);
    this.aimRing.scale.setScalar(1 + dist / 250);
    // Arc balistique prévu
    const v = Math.sqrt((range * GRAVITY) / 0.866);
    const el = 0.5 * Math.asin(clamp((dist * GRAVITY) / (v * v), 0, 1));
    const sx = p.x + Math.sin(p.h + center) * this.myStats.beam * 0.5, sz = p.z + Math.cos(p.h + center) * this.myStats.beam * 0.5;
    const hv = v * Math.cos(el), vy = v * Math.sin(el);
    const T = (2 * vy) / GRAVITY;
    const pos = this.aimLine.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const tt = (i / (pos.count - 1)) * T;
      pos.setXYZ(i, sx + Math.sin(yaw) * hv * tt, 4 + vy * tt - 0.5 * GRAVITY * tt * tt, sz + Math.cos(yaw) * hv * tt);
    }
    pos.needsUpdate = true;
    this.aimLine.computeLineDistances();
    this.fans.position.set(p.x, 1.6, p.z);
    this.fans.rotation.y = p.h;
    this.fans.scale.setScalar(range);
    for (let i = 0; i < 2; i++) {
      const aimed = (i === 0 ? 'babord' : 'tribord') === side && inArc;
      const ready = this.me.reload[i] <= 0.05;
      const fm = this.fanMats[i];
      fm.opacity = (i === 0 ? 'babord' : 'tribord') === side && this.rig.mode === '3d' ? 0.035 * lum : 0;
      fm.color.setHex(ready ? 0xf0c25a : 0xd0402a);
      const lm = (this.fans.children[i * 2] as THREE.Mesh).userData.outline as THREE.LineBasicMaterial;
      lm.opacity = (aimed ? 0.75 : (i === 0 ? 'babord' : 'tribord') === side ? 0.45 : 0.15) * (0.4 + 0.6 * lum);
      lm.color.setHex(ready ? 0xf0c25a : 0xd0402a);
    }
  }

  private updateMarkers(show: boolean) {
    const me = this.me;
    const nav = me?.nav;
    this.navRing.visible = show && !!nav;
    if (nav) {
      const pulse = 1 + 0.15 * Math.sin(this.t * 5);
      this.navRing.position.set(nav[0], waveHeight(nav[0], nav[1], this.t) + 0.8, nav[1]);
      this.navRing.scale.setScalar(pulse * (1 + this.rig.viewDist / 600));
    }
    const tid = me?.target || this.selectedId;
    const te = tid ? this.ents.get(tid) : undefined;
    if (me && !me.target && this.selectedId && !te) this.selectedId = 0;
    this.targetRing.visible = show && !!te;
    if (te) {
      const r = te.model ? te.model.dims.L * 0.7 : 30;
      this.targetRing.position.set(te.cur.x, waveHeight(te.cur.x, te.cur.z, this.t) + 1, te.cur.z);
      this.targetRing.scale.setScalar(r * (1 + 0.04 * Math.sin(this.t * 6)));
      this.targetRing.rotation.y = this.t * 0.5;
      (this.targetRing.material as THREE.MeshBasicMaterial).color.setHex(me?.attacking ? 0xff4a3a : 0xf0c25a);
    }
  }

  private updateLabels() {
    const W = this.labelsEl.clientWidth, H = this.labelsEl.clientHeight;
    const show = store.get().settings.labels && store.get().screen === 'game';
    const cam = this.camera.position;
    for (const e of this.ents.values()) {
      if (!e.label) continue;
      const c = e.cur;
      const d = Math.hypot(cam.x - c.x, cam.z - c.z);
      const top = e.model ? e.model.dims.L * 0.95 + 8 : e.meta.kind === 'fort' ? 30 : 8;
      const maxD = e.meta.kind === 'loot' ? 900 : e.meta.kind === 'boss' ? 4000 : 1500;
      const v = this.tmpV.set(c.x, top, c.z).project(this.camera);
      if (!show || v.z > 1 || d > maxD || (c.flags & F_SINKING && e.sinkT > 3)) { e.label.style.display = 'none'; continue; }
      e.label.style.display = '';
      e.label.style.transform = `translate(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -100%)`;
      e.label.style.opacity = String(clamp(1.3 - d / maxD, 0.25, 1));
      if (e.hpBar) e.hpBar.style.width = `${Math.max(0, c.hp * 100)}%`;
      const pvp = e.meta.kind === 'player' && (c.flags & F_PVP) && !(c.flags & F_SAFE);
      if (e.meta.kind === 'player') e.label.dataset.rel = e.meta.friend ? 'ami' : pvp || this.zone.pvp === 'libre' ? 'pvp' : 'neutre';
    }
    for (const l of this.worldLabels) {
      const d = Math.hypot(cam.x - l.x, cam.z - l.z);
      const maxD = l.kind === 'port' ? 4500 : l.kind === 'fort' ? 1600 : 2400;
      const v = this.tmpV.set(l.x, l.y, l.z).project(this.camera);
      if (!show || v.z > 1 || d > maxD || d < 120) { l.el.style.display = 'none'; continue; }
      l.el.style.display = '';
      l.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * W).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -100%)`;
      l.el.style.opacity = String(clamp(1.2 - d / maxD, 0, 0.95));
    }
  }

  private pushHud() {
    const me = this.me;
    const mine = this.ents.get(this.myId);
    const p = this.pred;
    let canDock: string | null = null;
    if (p && this.zoneVis) {
      for (const port of this.zone.ports) {
        const d = this.zoneVis.world.docks[port.id];
        if (Math.hypot(d.x - p.x, d.z - p.z) < DOCK_RADIUS) canDock = port.name;
      }
    }
    const nearby = [];
    if (p) {
      for (const e of this.ents.values()) {
        if (e.id === this.myId || !e.model || e.cur.flags & F_SINKING) continue;
        const d = Math.hypot(e.cur.x - p.x, e.cur.z - p.z);
        if (d > 1800) continue;
        const r = this.relation(e.meta);
        nearby.push({ id: e.id, name: e.meta.name, kind: e.meta.kind, level: e.meta.level, dist: d, hp: e.cur.hp, hostile: r.hostile || (e.meta.kind === 'player' && (this.zone.pvp === 'libre' || !!(e.cur.flags & F_PVP))), friend: r.friend, tag: e.meta.tag, ship: e.meta.ship, faction: e.meta.faction });
      }
      nearby.sort((a, b) => a.dist - b.dist);
    }
    store.set({
      hud: {
        hp: mine ? mine.cur.hp * (this.myStats?.hp ?? 1) : (this.myStats?.hp ?? 1),
        maxHp: this.myStats?.hp ?? 1,
        sailHp: mine?.cur.sailHp ?? 1,
        speed: p?.speed ?? 0,
        sail: this.sail,
        heading: p?.h ?? 0,
        windDir: this.wind.dir,
        windStr: this.wind.strength,
        reload: me?.reload ?? [0, 0],
        reloadMax: me?.reloadMax ?? 5,
        ammo: me?.ammo ?? 'rond',
        cd: me?.cd ?? {},
        dead: me?.dead ?? 0,
        pvp: me?.pvp ?? false,
        safe: me?.safe ?? true,
        powder: me?.powder ?? 0,
        burning: !!(mine && mine.cur.flags & F_BURNING),
        repairing: !!(mine && mine.cur.flags & F_REPAIRING),
        canDock,
        aim: this.aim.side,
        x: p?.x ?? 0,
        z: p?.z ?? 0,
        weather: this.weather.kind,
        day: this.day,
        fishing: !!me?.fishing,
      },
      nearby: nearby.slice(0, 8),
      attacking: !!me?.attacking,
      target: (() => {
        const id = me?.target || this.selectedId;
        const e = id ? this.ents.get(id) : undefined;
        if (!e || !p) return null;
        const r = this.relation(e.meta);
        return { id, name: e.meta.name, kind: e.meta.kind, level: e.meta.level, hp: e.cur.hp, dist: Math.hypot(e.cur.x - p.x, e.cur.z - p.z), hostile: r.hostile, faction: e.meta.faction, ship: e.meta.ship };
      })(),
    });
  }

  /** Données pour la mini-carte. */
  minimapState() {
    const ents: { x: number; z: number; kind: string; hostile: boolean; friend: boolean; me: boolean }[] = [];
    for (const e of this.ents.values()) {
      if (e.cur.flags & F_SINKING) continue;
      const r = this.relation(e.meta);
      ents.push({ x: e.cur.x, z: e.cur.z, kind: e.meta.kind, hostile: r.hostile, friend: r.friend, me: e.id === this.myId });
    }
    return { ents, half: this.zone.half, me: this.pred, camYaw: this.rig.yaw, wind: this.wind, ports: this.zone.ports, docks: this.zoneVis?.world.docks };
  }
}
