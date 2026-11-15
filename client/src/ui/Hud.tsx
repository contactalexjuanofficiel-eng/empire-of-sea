// Interface en mer : ressources, niveau, état du navire, armement, mini-carte, navires proches, missions, chat.
import { useEffect, useRef, useState } from 'react';
import { AMMO, AMMO_ORDER, CONSUMABLES, CONSUMABLE_ORDER } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import { SAIL_NAMES } from '../../../shared/physics';
import { levelFromXp, rankOf } from '../../../shared/progression';
import type { ChatChannel } from '../../../shared/protocol';
import { SHIP_BY_ID } from '../../../shared/ships';
import { FACTION_LABEL, ZONE_BY_ID } from '../../../shared/zones';
import { store, useStore, type Panel } from '../store';
import { keyLabel } from '../game/Input';
import { game, Icon, PORTRAITS, send } from './common';

const knots = (v: number) => (v * 0.7).toFixed(1);

export function TopBar() {
  const p = useStore((s) => s.profile);
  const zone = useStore((s) => s.zone);
  const ping = useStore((s) => s.ping);
  const conn = useStore((s) => s.connection);
  const fps = useStore((s) => s.fps);
  if (!p) return null;
  const lv = levelFromXp(p.xp);
  return (
    <div className="topbar">
      <div className="captain">
        <div className="portrait-sm">{PORTRAITS[p.portrait]}</div>
        <div>
          <div className="cap-name">{p.name}</div>
          <div className="cap-rank">{rankOf(lv.level)} · Niv. {lv.level}</div>
          <div className="xpbar" title={`${fmt(lv.into)} / ${fmt(lv.need)} XP`}><i style={{ width: `${lv.need ? (lv.into / lv.need) * 100 : 100}%` }} /></div>
        </div>
      </div>
      <div className="resources">
        <span title="Pièces d'or"><Icon name="or" className="c-or" />{fmt(p.or)}</span>
        <span title="Doublons"><Icon name="doublon" className="c-doublon" />{fmt(p.doublons)}</span>
        <span title="Perles"><Icon name="perle" className="c-perle" />{fmt(p.perles)}</span>
        <span title="Diamants"><Icon name="diamant" className="c-diamant" />{fmt(p.diamants ?? 0)}</span>
        <span title="Bois · Toile · Fer (ressources de construction)" className="mats"><Icon name="bois" />{p.mat.bois}<Icon name="toile" />{p.mat.toile}<Icon name="fer" />{p.mat.fer}</span>
      </div>
      <div className="zone-name">
        <Icon name="globe" /> {ZONE_BY_ID[zone]?.code} · {ZONE_BY_ID[zone]?.name}
        <span className={`net net-${conn}`} title="Latence">{conn === 'on' ? `${ping} ms · ${fps} i/s` : conn === 'lost' ? 'Connexion perdue…' : '…'}</span>
      </div>
    </div>
  );
}

export function MenuButtons() {
  const panel = useStore((s) => s.panel);
  const docked = useStore((s) => s.docked);
  const open = (p: Panel) => store.set({ panel: panel === p ? (docked ? 'port' : null) : p });
  const items: [Panel, string, string, string][] = [
    ['carte', 'carte', 'Carte du monde', 'M'],
    ['inventaire', 'sac', 'Inventaire', 'I'],
    ['profil', 'profil', 'Profil', 'C'],
    ['guilde', 'guilde', 'Guilde & groupe', 'U'],
    ['classement', 'trophee', 'Classement', 'K'],
    ['aide', 'aide', 'Aide', ''],
    ['parametres', 'reglages', 'Paramètres', 'Échap'],
  ];
  return (
    <div className="menu-buttons">
      {docked && <button className={`mb ${panel === 'port' ? 'on' : ''}`} onClick={() => store.set({ panel: 'port' })} title="Port"><Icon name="ancre" /></button>}
      {items.map(([id, icon, label, key]) => (
        <button key={id} className={`mb ${panel === id ? 'on' : ''}`} onClick={() => open(id)} title={`${label}${key ? ` (${key})` : ''}`}><Icon name={icon} /></button>
      ))}
    </div>
  );
}

function Compass({ heading, wind }: { heading: number; wind: number }) {
  // Cap : 0 = nord vers le haut de la mini-carte (z négatif). h = 0 pointe vers +z (sud).
  const deg = (r: number) => 180 - (r * 180) / Math.PI;
  return (
    <svg className="compass" viewBox="-50 -50 100 100">
      <circle r="46" className="c-ring" />
      {['N', 'E', 'S', 'O'].map((l, i) => (
        <text key={l} x={Math.sin((i * Math.PI) / 2) * 36} y={-Math.cos((i * Math.PI) / 2) * 36 + 4} className="c-l">{l}</text>
      ))}
      <g transform={`rotate(${deg(wind) + 180})`}><path d="M0 -30 L5 -44 L-5 -44 Z" className="c-wind" /></g>
      <g transform={`rotate(${deg(heading)})`}><path d="M0 -26 L7 10 L0 4 L-7 10 Z" className="c-ship" /></g>
    </svg>
  );
}

export function ShipStatus() {
  const hud = useStore((s) => s.hud);
  const p = useStore((s) => s.profile);
  if (!p) return null;
  const ship = SHIP_BY_ID[p.ships.find((x) => x.uid === p.active)?.def ?? 'bayonnaise'];
  const hpR = hud.hp / hud.maxHp;
  return (
    <div className="ship-status">
      <Compass heading={hud.heading} wind={hud.windDir} />
      <div className="ss-bars">
        <div className="ss-name">{ship.name}{hud.burning && <span className="tag-fire"><Icon name="feu" size={14} /> Incendie !</span>}{hud.repairing && <span className="tag-rep"><Icon name="marteau" size={14} /> Réparations</span>}</div>
        <div className={`bar bar-hp ${hpR < 0.3 ? 'low' : ''}`}><i style={{ width: `${hpR * 100}%` }} /><span>Coque {fmt(hud.hp)} / {fmt(hud.maxHp)}</span></div>
        <div className="bar bar-sail"><i style={{ width: `${hud.sailHp * 100}%` }} /><span>Voilure {Math.round(hud.sailHp * 100)} %</span></div>
        <div className="speedrow">
          <div className="sail-level" title="Voilure (Z/S ou ↑/↓)">
            {[0, 1, 2, 3].map((l) => <button key={l} className={hud.sail >= l && l > 0 ? 'on' : hud.sail === 0 && l === 0 ? 'on' : ''} onClick={() => game().setSail(l)}>{l === 0 ? '■' : '▲'.repeat(l)}</button>)}
          </div>
          <div className="speed"><b>{knots(hud.speed)}</b> nœuds<small>{SAIL_NAMES[hud.sail]}</small></div>
        </div>
      </div>
    </div>
  );
}

export function Weapons() {
  const hud = useStore((s) => s.hud);
  const p = useStore((s) => s.profile);
  const keys = useStore((s) => s.settings.keys);
  if (!p) return null;
  const r = (i: 0 | 1) => 1 - Math.min(1, hud.reload[i] / Math.max(0.1, hud.reloadMax));
  return (
    <div className="weapons">
      <div className="reloads">
        {(['babord', 'tribord'] as const).map((side, i) => (
          <button key={side} className={`reload ${hud.aim === side ? 'aimed' : ''} ${hud.reload[i] <= 0.05 ? 'ready' : ''}`} onClick={() => game().fire(side)} title={`Bordée ${side === 'babord' ? 'bâbord' : 'tribord'}`}>
            <span className="rl-label">{side === 'babord' ? 'Bâbord' : 'Tribord'}</span>
            <span className="rl-bar"><i style={{ width: `${r(i as 0 | 1) * 100}%` }} /></span>
            <span className="rl-t">{hud.reload[i] > 0.05 ? `${hud.reload[i].toFixed(1)} s` : 'Prêt'}</span>
          </button>
        ))}
      </div>
      <div className="slots">
        {AMMO_ORDER.map((id, i) => {
          const a = AMMO[id];
          const n = id === 'rond' ? '∞' : String(p.ammo[id] ?? 0);
          return (
            <button key={id} className={`slot ammo-${id} ${hud.ammo === id ? 'on' : ''} ${n === '0' ? 'empty' : ''}`} onClick={() => game().selectAmmo(id)} title={`${a.name} — ${a.desc}`}>
              <span className="k">{keyLabel(keys[`hot${i + 1}`])}</span>
              <span className="ball" />
              <span className="nm">{a.short}</span>
              <span className="q">{n}</span>
            </button>
          );
        })}
        <span className="sep" />
        {CONSUMABLE_ORDER.map((id, ci) => {
          const c = CONSUMABLES[id];
          const cd = hud.cd[id] ?? 0;
          return (
            <button key={id} className={`slot cons ${cd > 0 ? 'cool' : ''}`} onClick={() => game().useItem(id)} title={`${c.name} — ${c.desc}`}>
              <span className="k">{keyLabel(keys[`hot${6 + ci}`])}</span>
              <Icon name={id === 'kit' ? 'marteau' : id === 'seau' ? 'seau' : 'poudre'} size={20} />
              <span className="q">{p.items[id] ?? 0}</span>
              {cd > 0 && <span className="cdv">{Math.ceil(cd)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      const c = ref.current;
      if (!c) return;
      const g = c.getContext('2d')!;
      const W = c.width;
      const gm = game();
      const img = gm.minimapImage();
      const st = gm.minimapState();
      const half = st.half;
      const me = st.me;
      const span = (half * 2) / zoom;
      const cx = zoom > 1 && me ? me.x : 0, cz = zoom > 1 && me ? me.z : 0;
      const toX = (x: number) => ((x - cx) / span + 0.5) * W;
      const toY = (z: number) => ((z - cz) / span + 0.5) * W;
      g.fillStyle = '#0a1a26';
      g.fillRect(0, 0, W, W);
      if (img) {
        const sx = ((cx - span / 2 + half) / (half * 2)) * img.width;
        const sy = ((cz - span / 2 + half) / (half * 2)) * img.height;
        g.drawImage(img, sx, sy, (span / (half * 2)) * img.width, (span / (half * 2)) * img.height, 0, 0, W, W);
      }
      g.strokeStyle = 'rgba(240,194,90,0.12)';
      g.lineWidth = 1;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo((i * W) / 4, 0); g.lineTo((i * W) / 4, W); g.moveTo(0, (i * W) / 4); g.lineTo(W, (i * W) / 4); g.stroke(); }
      for (const p of st.ports) {
        const d = st.docks?.[p.id];
        if (!d) continue;
        g.fillStyle = '#f0c25a';
        g.font = '600 10px Cinzel, serif';
        g.textAlign = 'center';
        g.beginPath(); g.arc(toX(d.x), toY(d.z), 3.5, 0, 7); g.fill();
        g.fillText(p.name, toX(d.x), toY(d.z) - 6);
      }
      const boss = store.get().boss;
      if (boss.active && boss.x !== undefined) {
        g.fillStyle = '#4fffc0';
        g.font = '14px serif';
        g.fillText('☠', toX(boss.x), toY(boss.z!));
      }
      for (const e of st.ents) {
        if (e.me) continue;
        g.fillStyle = e.kind === 'loot' ? '#ffd36a' : e.kind === 'boss' ? '#4fffc0' : e.kind === 'fort' ? (e.hostile ? '#c0392b' : '#9ab') : e.kind === 'player' ? (e.friend ? '#6fdc8c' : '#e8f0ff') : '#e0452f';
        const r = e.kind === 'boss' ? 4 : e.kind === 'player' ? 3 : 2.4;
        g.beginPath(); g.arc(toX(e.x), toY(e.z), r, 0, 7); g.fill();
      }
      if (me) {
        const x = toX(me.x), y = toY(me.z);
        // cône de vision de la caméra
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.moveTo(x, y);
        const cy = st.camYaw + Math.PI;
        g.arc(x, y, 40, Math.atan2(Math.cos(cy), Math.sin(cy)) - 0.5, Math.atan2(Math.cos(cy), Math.sin(cy)) + 0.5);
        g.fill();
        g.save();
        g.translate(x, y);
        g.rotate(Math.atan2(Math.cos(me.h), Math.sin(me.h)));
        g.fillStyle = '#fff';
        g.strokeStyle = '#000';
        g.beginPath(); g.moveTo(8, 0); g.lineTo(-5, 5); g.lineTo(-2, 0); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke();
        g.restore();
      }
      // flèche du vent
      g.save();
      g.translate(W - 16, 16);
      g.rotate(Math.atan2(Math.cos(st.wind.dir), Math.sin(st.wind.dir)));
      g.strokeStyle = '#bfe3ff';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-9, 0); g.lineTo(9, 0); g.lineTo(4, -4); g.moveTo(9, 0); g.lineTo(4, 4); g.stroke();
      g.restore();
    }, 100);
    return () => clearInterval(id);
  }, [zoom]);
  return (
    <div className="minimap">
      <canvas ref={ref} width={220} height={220} />
      <div className="mm-tools">
        <button onClick={() => setZoom((z) => (z >= 4 ? 1 : z * 2))} title="Zoom de la carte">{zoom === 1 ? '+' : `×${zoom}`}</button>
        <button onClick={() => store.set({ panel: 'carte' })} title="Cartes"><Icon name="carte" size={14} /></button>
      </div>
    </div>
  );
}

export function Nearby() {
  const list = useStore((s) => s.nearby);
  if (!list.length) return null;
  return (
    <div className="nearby">
      <h4>Navires à proximité</h4>
      {list.map((n) => (
        <div key={n.id} className={`nb ${n.friend ? 'ami' : n.hostile ? 'ennemi' : ''} kind-${n.kind}`}>
          <span className="nb-lv">{n.level}</span>
          <span className="nb-name">{n.kind === 'player' ? `${n.tag ? `[${n.tag}] ` : ''}${n.name}` : n.name}{n.kind !== 'player' && <em> PNJ</em>}</span>
          <span className="nb-d">{Math.round(n.dist)} m</span>
          <span className="nb-hp"><i style={{ width: `${n.hp * 100}%` }} /></span>
        </div>
      ))}
    </div>
  );
}

export function Missions() {
  const p = useStore((s) => s.profile);
  if (!p || !p.missions.length) return null;
  return (
    <div className="missions">
      <h4><Icon name="parchemin" size={14} /> Missions</h4>
      {p.missions.map((m) => (
        <div key={m.id} className="ms">
          <b>{m.title}</b>
          <div className="ms-prog"><i style={{ width: `${(m.progress / m.goal) * 100}%` }} /><span>{m.type === 'boss' ? `${fmt(m.progress)} / ${fmt(m.goal)}` : `${m.progress} / ${m.goal}`}</span></div>
        </div>
      ))}
    </div>
  );
}

const CH_LABEL: Record<ChatChannel, string> = { zone: 'Zone', monde: 'Monde', guilde: 'Guilde', groupe: 'Groupe', prive: 'Privé', systeme: 'Amirauté' };

export function Chat() {
  const lines = useStore((s) => s.chat);
  const focus = useStore((s) => s.chatFocus);
  const [ch, setCh] = useState<ChatChannel>('zone');
  const [text, setText] = useState('');
  const [to, setTo] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (focus) input.current?.focus(); }, [focus]);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [lines]);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    let t = text.trim();
    if (!t) { input.current?.blur(); return; }
    let channel = ch, dest = to;
    const mp = t.match(/^\/(mp|w)\s+(\S+)\s+(.+)$/i);
    if (mp) { channel = 'prive'; dest = mp[2]; t = mp[3]; }
    send({ t: 'chat', ch: channel, text: t, to: dest || undefined });
    setText('');
  }
  return (
    <div className="chat">
      <div className="chat-tabs">
        {(['zone', 'monde', 'guilde', 'groupe', 'prive'] as ChatChannel[]).map((c) => (
          <button key={c} className={ch === c ? 'on' : ''} onClick={() => setCh(c)}>{CH_LABEL[c]}</button>
        ))}
      </div>
      <div className="chat-lines" ref={box}>
        {lines.map((l) => (
          <div key={l.id} className={`cl ch-${l.ch}`}>
            <span className="cl-ch">[{CH_LABEL[l.ch]}]</span> {l.tag && <span className="cl-tag">[{l.tag}]</span>} <span className="cl-from">{l.from}</span> : <span className="cl-text">{l.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="chat-in">
        {ch === 'prive' && <input className="chat-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Destinataire" maxLength={16} />}
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Entrée pour parler · /mp Nom message" />
      </form>
    </div>
  );
}

export function Notices() {
  const list = useStore((s) => s.notices);
  return (
    <div className="notices">
      {list.map((n) => <div key={n.id} className={`notice n-${n.kind}`}>{n.text}</div>)}
    </div>
  );
}

export function BossBar() {
  const b = useStore((s) => s.boss);
  if (!b.active || !b.maxHp) return null;
  return (
    <div className="bossbar">
      <div className="bb-name">☠ {b.name}</div>
      <div className="bb-bar"><i style={{ width: `${((b.hp ?? b.maxHp) / b.maxHp) * 100}%` }} /></div>
    </div>
  );
}

export function SeaPrompts() {
  const hud = useStore((s) => s.hud);
  const docked = useStore((s) => s.docked);
  const zone = useStore((s) => s.zone);
  if (docked) return null;
  const pvpZone = ZONE_BY_ID[zone]?.pvp === 'libre';
  return (
    <>
      {hud.canDock && hud.dead <= 0 && (
        <button className="dock-prompt" onClick={() => game().dock()}><Icon name="ancre" /> Accoster à {hud.canDock} <kbd>P</kbd></button>
      )}
      <div className={`pvp-flag ${hud.pvp || pvpZone ? 'on' : ''}`} onClick={() => !pvpZone && send({ t: 'pvp', on: !hud.pvp })} title={pvpZone ? 'Zone de guerre ouverte : PvP permanent hors des ports' : 'Pavillon de combat (B) : autorise le PvP avec les autres capitaines au pavillon rouge'}>
        <Icon name="drapeau" size={16} /> {pvpZone ? 'Zone PvP' : hud.pvp ? 'Pavillon rouge' : 'Pavillon blanc'}{hud.safe && <em> · zone protégée</em>}
      </div>
      {hud.dead > 0 && (
        <div className="death">
          <h2>Votre navire a sombré</h2>
          <p>Les chaloupes vous ramènent au port… {Math.ceil(hud.dead)} s</p>
        </div>
      )}
      {hud.powder > 0 && <div className="buff">Poudre fine · {Math.ceil(hud.powder)} s</div>}
    </>
  );
}

export function Hints() {
  const [show, setShow] = useState(true);
  const docked = useStore((s) => s.docked);
  useEffect(() => { const t = setTimeout(() => setShow(false), 25000); return () => clearTimeout(t); }, []);
  if (!show || docked) return null;
  return (
    <div className="hints" onClick={() => setShow(false)}>
      <b>Commandes</b> · <b>clic sur la mer</b> : naviguer · <b>clic sur un ennemi</b> : attaquer · molette : zoom · clic droit glissé : déplacer la vue · barre rapide <kbd>1</kbd>–<kbd>8</kbd> · toutes les touches se règlent dans Paramètres
    </div>
  );
}

/** Indicateur de carte (ex. « 3/1 ») sous la mini-carte : ouvre la grille des cartes. */
export function MapBadge() {
  const zone = useStore((s) => s.zone);
  const maps = useStore((s) => s.maps);
  const z = ZONE_BY_ID[zone];
  const n = maps.find((m) => m.id === zone)?.players ?? 1;
  if (!z) return null;
  return (
    <button className={`map-badge ${z.pvp === 'libre' ? 'war' : ''}`} onClick={() => store.set({ panel: 'carte' })} title="Cartes (changer de carte)">
      <span className="mb-pl">({n})</span><b>{z.code}</b><span className="mb-name">{z.name}</span>
    </button>
  );
}

/** Cadre de la cible sélectionnée. */
export function TargetFrame() {
  const t = useStore((s) => s.target);
  const attacking = useStore((s) => s.attacking);
  if (!t) return null;
  return (
    <div className={`target-frame ${t.hostile ? 'ennemi' : ''} ${attacking ? 'attacking' : ''}`}>
      <div className="tf-head"><span className="nb-lv">{t.level}</span><b>{t.name}</b>{t.kind !== 'player' && <em>PNJ</em>}</div>
      <div className="tf-sub">{t.kind === 'player' ? 'Capitaine' : FACTION_LABEL[t.faction as keyof typeof FACTION_LABEL] ?? ''}{t.ship && SHIP_BY_ID[t.ship] ? ` · ${SHIP_BY_ID[t.ship].name}` : ''} · {Math.round(t.dist)} m</div>
      <div className="bar bar-hp"><i style={{ width: `${t.hp * 100}%` }} /><span>{Math.round(t.hp * 100)} %</span></div>
      <div className="row">
        {attacking ? <button className="btn danger small" onClick={() => game().cancelAttack()}>Annuler l'attaque</button>
          : <button className="btn-gold small" onClick={() => game().attack(t.id)}>Attaquer</button>}
      </div>
    </div>
  );
}
