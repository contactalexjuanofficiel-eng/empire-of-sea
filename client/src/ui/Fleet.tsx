// Flotte de l'ère moderne : les 25 navires, aperçu 3D orientable (rotation 360°, zoom), caractéristiques, achat,
// sélection et export du modèle au format GLB.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MODERN_CATEGORIES } from '../../../shared/modern';
import { levelFromXp } from '../../../shared/progression';
import { computeStats, MODERN_PLAYER_SHIPS, RARITY_COLOR, RARITY_LABEL, SHIP_BY_ID, SHIP_CLASSES } from '../../../shared/ships';
import { ZONE_BY_ID } from '../../../shared/zones';
import { makeShipModel, type AnyShipModel } from '../game/render/factory';
import { store, useStore } from '../store';
import { Frame, Price, send, StatBar, RoleBadge } from './common';

const close = () => store.set((s) => ({ panel: s.docked ? 'port' : null }));

// Maxima de la flotte moderne : les barres se comparent entre les 25 navires.
const ALL = MODERN_PLAYER_SHIPS.map((d) => computeStats(d));
const MAX = {
  hp: Math.max(...ALL.map((s) => s.hp)), speed: Math.max(...ALL.map((s) => s.speed)), accel: Math.max(...ALL.map((s) => s.accel)),
  turn: Math.max(...ALL.map((s) => s.turn)), armor: Math.max(...ALL.map((s) => s.armor)), fire: Math.max(...ALL.map((s) => s.broadside)), cargo: Math.max(...ALL.map((s) => s.cargo)),
};

/** Visionneuse 3D autonome : son propre rendu, lumière de studio, eau stylisée, rotation et zoom à la souris. */
export function ShipViewer({ shipId, onModel }: { shipId: string; onModel?: (m: AnyShipModel | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.background = null;
    const cam = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    sun.position.set(80, 120, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = sc.bottom = -90; sc.right = sc.top = 90;
    scene.add(sun, new THREE.HemisphereLight(0xbfd8ff, 0x1a2a3a, 0.8));
    const water = new THREE.Mesh(new THREE.CircleGeometry(4000, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0e3a5a, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.88 }));
    water.receiveShadow = true;
    scene.add(water);
    const def = SHIP_BY_ID[shipId];
    const model = makeShipModel(def);
    model.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    scene.add(model.root);
    onModel?.(model);
    // Cadrage selon la boîte englobante (les mâts d'un trois-mâts dépassent largement la coque).
    const size = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3());
    const L = Math.max(size.z, size.y * 1.7, model.dims.L);
    cam.position.set(L * 0.95, L * 0.5, L * 1.05);
    const ctl = new OrbitControls(cam, renderer.domElement);
    ctl.target.set(0, Math.max(model.dims.F, size.y * 0.4), 0);
    ctl.enableDamping = true;
    ctl.minDistance = L * 0.5;
    ctl.maxDistance = L * 4;
    ctl.maxPolarAngle = Math.PI * 0.49;
    ctl.autoRotate = true;
    ctl.autoRotateSpeed = 0.8;
    ctl.addEventListener('start', () => { ctl.autoRotate = false; });
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const clock = new THREE.Clock();
    let t = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(0.05, clock.getDelta());
      t += dt;
      model.body.position.y = Math.sin(t * 1.2) * 0.25 - 0.2;
      model.body.rotation.z = Math.sin(t * 0.9) * 0.025;
      model.body.rotation.x = Math.sin(t * 0.7) * 0.012;
      model.update(t, dt, 3, 1.6, 0.9, 0, 0, 0);
      ctl.update();
      renderer.render(scene, cam);
    });
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      ctl.dispose();
      onModel?.(null);
      model.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [shipId]);
  return <div className="viewer" ref={box} />;
}

export function FleetPanel() {
  const p = useStore((s) => s.profile)!;
  const docked = useStore((s) => s.docked);
  const zone = ZONE_BY_ID[useStore((s) => s.zone)];
  const [sel, setSel] = useState(MODERN_PLAYER_SHIPS[0].id);
  const model = useRef<AnyShipModel | null>(null);
  const def = SHIP_BY_ID[sel];
  const st = computeStats(def);
  const owned = p.ships.find((s) => s.def === def.id);
  const lvl = levelFromXp(p.xp).level;
  const cls = SHIP_CLASSES[def.cls];
  const exportGlb = () => {
    const m = model.current;
    if (!m) return;
    new GLTFExporter().parse(m.root, (res) => {
      const blob = new Blob([res as ArrayBuffer], { type: 'model/gltf-binary' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${def.id.replace(/^m_/, '')}.glb`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, () => {}, { binary: true });
  };
  return (
    <Frame title="Flotte moderne — Marine nationale" icon="ancre" onClose={close} wide className="fleet-frame">
      <div className="fleet">
        <div className="fleet-list">
          {MODERN_CATEGORIES.map((c) => (
            <div key={c.id}>
              <div className="cls-head">{c.name}</div>
              {MODERN_PLAYER_SHIPS.filter((s) => s.cls === c.cls).map((s) => (
                <button key={s.id} className={`ship-row ${sel === s.id ? 'on' : ''} ${lvl < s.level ? 'locked' : ''}`} onClick={() => setSel(s.id)}>
                  <span className="sr-name" style={{ color: RARITY_COLOR[s.rarity] }}>{s.name}</span>
                  <span className="sr-info">{p.ships.some((x) => x.def === s.id) ? 'Possédé' : `Niv. ${s.level}`}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="fleet-view">
          <ShipViewer shipId={sel} onModel={(m) => { model.current = m; }} />
          <div className="viewer-hint">Glissez pour tourner à 360° · molette pour zoomer</div>
        </div>
        <div className="fleet-detail">
          <h3>{def.name}</h3>
          <span className="rarity" style={{ borderColor: RARITY_COLOR[def.rarity], color: RARITY_COLOR[def.rarity] }}>{RARITY_LABEL[def.rarity]}</span> <RoleBadge def={def} />
          <div className="sd-class">{cls.name} · {def.size?.L ?? cls.length} m · niveau {def.level}</div>
          <p className="history">{def.history}</p>
          <StatBar label="Points de vie" value={st.hp} max={MAX.hp} />
          <StatBar label="Vitesse max" value={st.speed} max={MAX.speed} fmtValue={`${(st.speed * 0.7).toFixed(1)} nds`} />
          <StatBar label="Accélération" value={st.accel} max={MAX.accel} fmtValue={st.accel.toFixed(1)} />
          <StatBar label="Maniabilité" value={st.turn} max={MAX.turn} fmtValue={`${Math.round(st.turn * 100)}`} />
          <StatBar label="Blindage" value={st.armor} max={MAX.armor} fmtValue={`${Math.round(st.armor * 100)} %`} />
          <StatBar label="Puissance de feu" value={st.broadside} max={MAX.fire} fmtValue={`${Math.round(st.broadside)}`} />
          <StatBar label="Chargement" value={st.cargo} max={MAX.cargo} fmtValue={`${st.cargo} t`} />
          <div className="sd-actions">
            {owned ? (
              owned.uid === p.active ? <span className="ok">Navire actif</span>
                : zone?.era === 'moderne' ? <button className="btn-gold big" disabled={!docked} onClick={() => send({ t: 'shop', a: 'selectShip', uid: owned.uid })}>Sélectionner</button>
                : <span className="muted small">Utilisable sur les cartes de l'ère moderne (M1 à M5)</span>
            ) : (
              <>
                <Price p={def.price} />
                <button className="btn-gold big" disabled={!docked || lvl < def.level} onClick={() => send({ t: 'shop', a: 'buyShip', ship: def.id })}>{!docked ? 'Achat au port' : lvl < def.level ? `Niveau ${def.level} requis` : 'Acheter'}</button>
              </>
            )}
            <button className="btn" onClick={exportGlb} title="Télécharger le modèle 3D au format standard GLB">Exporter en GLB</button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
