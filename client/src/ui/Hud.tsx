// Interface en mer (éléments communs) : mini-carte, discussion, annonces, boss, pavillon, naufrage, aide.
import { useEffect, useRef, useState } from 'react';
import type { ChatChannel } from '../../../shared/protocol';
import { ZONE_BY_ID } from '../../../shared/zones';
import { store, useStore } from '../store';
import { game, Icon, send } from './common';

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
      <div className={`pvp-flag ${hud.pvp || pvpZone ? 'on' : ''}`} onClick={() => !pvpZone && send({ t: 'pvp', on: !hud.pvp })} title={pvpZone ? 'Zone de guerre ouverte : PvP permanent hors des ports' : 'Pavillon de combat (B) : autorise le PvP avec les autres capitaines au pavillon rouge'}>
        <Icon name="drapeau" size={16} /> {pvpZone ? 'Zone PvP' : hud.pvp ? 'Pavillon rouge' : 'Pavillon blanc'}{hud.safe && <em> · zone protégée</em>}
      </div>
      {hud.dead > 0 && (
        <div className="death">
          <h2>Votre navire a sombré</h2>
          <p>Votre équipage renfloue le navire… retour en mer dans {Math.ceil(hud.dead)} s</p>
        </div>
      )}
    </>
  );
}

export function Hints() {
  const [show, setShow] = useState(true);
  const docked = useStore((s) => s.docked);
  const tuto = useStore((s) => (s.profile?.tutorial ?? 99) < 6);
  useEffect(() => { const t = setTimeout(() => setShow(false), 25000); return () => clearTimeout(t); }, []);
  if (!show || docked || tuto) return null;
  return (
    <div className="hints" onClick={() => setShow(false)}>
      <b>Commandes</b> · <b>clic sur la mer</b> : naviguer · <b>clic sur un ennemi</b> : attaquer · molette : zoom · clic droit glissé : déplacer la vue · munitions <kbd>1</kbd>–<kbd>7</kbd> · objets <kbd>8</kbd> <kbd>9</kbd> <kbd>0</kbd> · <kbd>N</kbd> pêcher · toutes les touches se règlent dans Paramètres
    </div>
  );
}
