// Panneaux : inventaire, profil, classement, guilde et groupe, carte du monde, paramètres, aide.
import { useEffect, useState } from 'react';
import { AMMO, AMMO_ORDER, CONSUMABLES, CONSUMABLE_ORDER, GOODS, MATERIAL_NAMES, type GoodId, type MaterialId } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import { levelFromXp, rankOf, reputationName, RANKS } from '../../../shared/progression';
import type { LeaderEntry } from '../../../shared/protocol';
import { computeStats, RARITY_COLOR, SHIP_BY_ID, SHIP_CLASSES } from '../../../shared/ships';
import { FACTION_LABEL, ZONES, ZONE_BY_ID } from '../../../shared/zones';
import { saveSettings, store, useStore } from '../store';
import { Frame, game, Icon, PORTRAITS, PORTRAIT_NAMES, send } from './common';

const close = () => store.set((s) => ({ panel: s.docked ? 'port' : null }));

export function Inventory() {
  const p = useStore((s) => s.profile)!;
  return (
    <Frame title="Inventaire" icon="sac" onClose={close}>
      <div className="inv-grid">
        <section>
          <h3>Trésorerie</h3>
          <div className="inv-line"><Icon name="or" className="c-or" /> Pièces d'or <b>{fmt(p.or)}</b></div>
          <div className="inv-line"><Icon name="doublon" className="c-doublon" /> Doublons <b>{fmt(p.doublons)}</b></div>
          <div className="inv-line"><Icon name="perle" className="c-perle" /> Perles <b>{fmt(p.perles)}</b></div>
          <h3>Ressources de construction</h3>
          {(Object.keys(MATERIAL_NAMES) as MaterialId[]).map((k) => <div key={k} className="inv-line"><Icon name={k} /> {MATERIAL_NAMES[k]} <b>{p.mat[k]}</b></div>)}
        </section>
        <section>
          <h3>Soute à munitions</h3>
          {AMMO_ORDER.map((id) => <div key={id} className="inv-line"><span className={`ball-ico ammo-${id}`} /> {AMMO[id].name} <b>{id === 'rond' ? '∞' : p.ammo[id]}</b></div>)}
          <h3>Équipements</h3>
          {CONSUMABLE_ORDER.map((id) => <div key={id} className="inv-line"><Icon name={id === 'kit' ? 'marteau' : id === 'seau' ? 'seau' : 'poudre'} /> {CONSUMABLES[id].name} <b>{p.items[id]}</b></div>)}
        </section>
        <section>
          <h3>Cale</h3>
          {Object.entries(p.cargo).filter(([, q]) => q).map(([g, q]) => <div key={g} className="inv-line"><Icon name="coffre" /> {GOODS[g as GoodId].name} <b>{q}</b></div>)}
          {!Object.values(p.cargo).some(Boolean) && <p className="muted">La cale est vide.</p>}
          <h3>Flotte ({p.ships.length}/8)</h3>
          {p.ships.map((s) => {
            const d = SHIP_BY_ID[s.def];
            return <div key={s.uid} className="inv-line"><Icon name="voile" /> <span style={{ color: RARITY_COLOR[d.rarity] }}>{d.name}</span> <small className="muted">{SHIP_CLASSES[d.cls].name}</small> {s.uid === p.active && <b>★</b>}</div>;
          })}
        </section>
      </div>
    </Frame>
  );
}

export function ProfilePanel() {
  const p = useStore((s) => s.profile)!;
  const guild = useStore((s) => s.guild);
  const lv = levelFromXp(p.xp);
  const ship = p.ships.find((s) => s.uid === p.active)!;
  const st = computeStats(SHIP_BY_ID[ship.def], ship.up, p.skills);
  const zonesDisc = ZONES.map((z) => ({ z, n: p.discovered.filter((d) => d.startsWith(z.id + ':')).length }));
  return (
    <Frame title="Profil du capitaine" icon="profil" onClose={close}>
      <div className="profile">
        <div className="pf-id">
          <div className="portrait-lg">{PORTRAITS[p.portrait]}</div>
          <div>
            <h3>{guild?.tag ? `[${guild.tag}] ` : ''}{p.name}</h3>
            <div className="rank">{rankOf(lv.level)}</div>
            <div className="muted">{PORTRAIT_NAMES[p.portrait]} · Pavillon {p.flag === 'royal' ? 'royal' : p.flag === 'tricolore' ? 'tricolore' : 'impérial'}</div>
            <div className="xpbar big"><i style={{ width: `${lv.need ? (lv.into / lv.need) * 100 : 100}%` }} /><span>Niveau {lv.level} · {fmt(lv.into)} / {fmt(lv.need)} XP</span></div>
            <div>Réputation : <b>{reputationName(p.reputation)}</b> ({fmt(p.reputation)})</div>
          </div>
        </div>
        <div className="pf-cols">
          <section>
            <h4>Faits d'armes</h4>
            <div className="kv"><span>Navires coulés</span><b>{p.stats.kills}</b></div>
            <div className="kv"><span>Victoires contre des joueurs</span><b>{p.stats.pvp}</b></div>
            <div className="kv"><span>Boss vaincus</span><b>{p.stats.boss}</b></div>
            <div className="kv"><span>Dégâts infligés</span><b>{fmt(p.stats.damage)}</b></div>
            <div className="kv"><span>Naufrages</span><b>{p.stats.deaths}</b></div>
            <div className="kv"><span>Trésors</span><b>{p.stats.treasures}</b></div>
            <div className="kv"><span>Ventes au marché</span><b>{p.stats.trades}</b></div>
          </section>
          <section>
            <h4>Navire actif : {SHIP_BY_ID[ship.def].name}</h4>
            <div className="kv"><span>Coque</span><b>{fmt(st.hp)}</b></div>
            <div className="kv"><span>Vitesse</span><b>{(st.speed * 0.7).toFixed(1)} nœuds</b></div>
            <div className="kv"><span>Bordée</span><b>{Math.round(st.broadside)}</b></div>
            <div className="kv"><span>Portée</span><b>{Math.round(st.range)} m</b></div>
            <div className="kv"><span>Rechargement</span><b>{st.reload.toFixed(1)} s</b></div>
            <h4>Exploration</h4>
            {zonesDisc.map(({ z, n }) => <div key={z.id} className="kv"><span>{z.name}</span><b>{n} / {z.islands + z.ports.length}</b></div>)}
          </section>
          <section>
            <h4>Grades</h4>
            {RANKS.map((r) => <div key={r.title} className={`kv ${lv.level >= r.level ? '' : 'muted'}`}><span>{r.title}</span><b>Niv. {r.level}</b></div>)}
          </section>
        </div>
      </div>
    </Frame>
  );
}

export function Leaderboard() {
  const [list, setList] = useState<LeaderEntry[] | null>(null);
  const me = useStore((s) => s.name);
  useEffect(() => { fetch('/api/classement').then((r) => r.json()).then(setList).catch(() => setList([])); }, []);
  return (
    <Frame title="Classement mondial" icon="trophee" onClose={close}>
      {!list && <p className="muted">Chargement…</p>}
      {list && (
        <table className="ranking">
          <thead><tr><th>#</th><th>Capitaine</th><th>Grade</th><th>Niv.</th><th>Coulés</th><th>PvP</th><th>Navire</th></tr></thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={e.name} className={e.name === me ? 'me' : ''}>
                <td>{i + 1}</td><td>{e.tag ? `[${e.tag}] ` : ''}{e.name}</td><td>{rankOf(e.level)}</td><td>{e.level}</td><td>{e.kills}</td><td>{e.pvp}</td><td>{e.ship}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Frame>
  );
}

export function GuildPanel() {
  const g = useStore((s) => s.guild);
  const group = useStore((s) => s.group);
  const me = useStore((s) => s.name);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [target, setTarget] = useState('');
  const [other, setOther] = useState('');
  const leader = g && g.leader === me;
  return (
    <Frame title="Guilde & groupe" icon="guilde" onClose={close}>
      <div className="guild">
        <section>
          {g && g.name ? (
            <>
              <h3>[{g.tag}] {g.name}</h3>
              <p className="muted">Chef : {g.leader}</p>
              <h4>Membres ({g.members.length})</h4>
              {g.members.map((m) => (
                <div key={m.name} className="kv"><span><i className={`dot ${m.online ? 'on' : ''}`} /> {m.name}</span><b>{m.online ? `Niv. ${m.level}` : 'hors ligne'}</b>
                  {leader && m.name !== me && <button className="btn small" onClick={() => send({ t: 'guild', a: 'kick', name: m.name })}>Exclure</button>}
                </div>
              ))}
              <h4>Diplomatie</h4>
              <div className="kv"><span>Alliés</span><b>{g.allies.join(', ') || '—'}</b></div>
              <div className="kv"><span>En guerre contre</span><b className="war">{g.wars.join(', ') || '—'}</b></div>
              {leader && (
                <>
                  <div className="row">
                    <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Nom du capitaine" maxLength={16} />
                    <button className="btn-gold" onClick={() => send({ t: 'guild', a: 'invite', name: target })}>Inviter</button>
                  </div>
                  <div className="row">
                    <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Nom ou blason d'une guilde" maxLength={24} />
                    <button className="btn" onClick={() => send({ t: 'guild', a: 'ally', name: other })}>Alliance</button>
                    <button className="btn danger" onClick={() => send({ t: 'guild', a: 'war', name: other })}>Guerre</button>
                    <button className="btn" onClick={() => send({ t: 'guild', a: 'peace', name: other })}>Paix</button>
                  </div>
                </>
              )}
              <button className="btn danger" onClick={() => send({ t: 'guild', a: 'leave' })}>Quitter la guilde</button>
            </>
          ) : (
            <>
              <h3>Fonder une guilde</h3>
              <p className="muted">Coût : 5 000 or. Les membres d'une même guilde et ses alliés ne peuvent pas se tirer dessus ; en guerre, les primes sont doublées et le combat est permis partout hors des ports.</p>
              <div className="row">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la guilde" maxLength={24} />
                <input value={tag} onChange={(e) => setTag(e.target.value.toUpperCase())} placeholder="Blason (2-4)" maxLength={4} className="short" />
                <button className="btn-gold" onClick={() => send({ t: 'guild', a: 'create', name, tag })}>Fonder</button>
              </div>
              {g?.invites?.length ? (
                <>
                  <h4>Invitations reçues</h4>
                  {g.invites.map((n) => <div key={n} className="kv"><span>{n}</span><button className="btn-gold small" onClick={() => send({ t: 'guild', a: 'accept', name: n })}>Rejoindre</button></div>)}
                </>
              ) : null}
            </>
          )}
        </section>
        <section>
          <h3>Groupe (escadre)</h3>
          <p className="muted">Jusqu'à 5 capitaines. Pas de tirs amis, et chacun reçoit sa part des récompenses selon ses dégâts.</p>
          {group.members.map((m) => <div key={m} className="kv"><span>{m}</span>{group.leader === m && <b>Chef d'escadre</b>}</div>)}
          {group.invite && <div className="row"><span>{group.invite} vous invite.</span><button className="btn-gold small" onClick={() => send({ t: 'group', a: 'accept' })}>Accepter</button></div>}
          <div className="row">
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Nom du capitaine" maxLength={16} />
            <button className="btn-gold" onClick={() => send({ t: 'group', a: 'invite', name: target })}>Inviter</button>
          </div>
          {group.members.length > 0 && <button className="btn" onClick={() => send({ t: 'group', a: 'leave' })}>Quitter le groupe</button>}
        </section>
      </div>
    </Frame>
  );
}

export function WorldMap() {
  const zone = useStore((s) => s.zone);
  const docked = useStore((s) => s.docked);
  const p = useStore((s) => s.profile)!;
  const lvl = levelFromXp(p.xp).level;
  const [sel, setSel] = useState(zone);
  const z = ZONE_BY_ID[sel];
  const enemies = [...new Set(z.enemies.map((e) => e.faction))];
  return (
    <Frame title="Carte du monde" icon="carte" onClose={close} wide>
      <div className="worldmap">
        <svg viewBox="0 0 100 80" className="wm-svg">
          <defs>
            <radialGradient id="wmsea" cx="50%" cy="45%" r="70%"><stop offset="0" stopColor="#1b3a52" /><stop offset="1" stopColor="#0a1622" /></radialGradient>
          </defs>
          <rect width="100" height="80" fill="url(#wmsea)" />
          {/* Côtes stylisées (dessin original) */}
          <path d="M44 8 Q52 6 56 12 Q58 20 54 26 Q58 34 56 44 Q54 50 58 56 Q50 58 46 52 Q44 44 48 36 Q44 28 47 20 Q42 14 44 8 Z" className="wm-land" />
          <path d="M52 56 Q62 54 74 58 Q80 62 72 66 Q62 64 54 62 Z" className="wm-land" />
          <path d="M60 4 Q72 2 80 8 Q78 14 70 14 Q64 12 60 4 Z" className="wm-land" />
          <path d="M6 54 Q14 50 22 56 Q20 62 12 64 Q6 62 6 54 Z M18 66 Q22 64 26 68 Q22 70 18 66 Z" className="wm-land" />
          <path d="M74 66 Q86 62 96 70 Q92 78 80 76 Q74 72 74 66 Z" className="wm-land" />
          {ZONES.map((zz) => {
            const locked = lvl < zz.levels[0] - 1;
            return (
              <g key={zz.id} className={`wm-zone ${zz.id === zone ? 'here' : ''} ${zz.id === sel ? 'sel' : ''} ${locked ? 'locked' : ''}`} onClick={() => setSel(zz.id)}>
                <circle cx={zz.mapPos.x} cy={zz.mapPos.y} r={zz.id === zone ? 3.2 : 2.4} />
                <text x={zz.mapPos.x} y={zz.mapPos.y - 4}>{zz.name}</text>
                <text x={zz.mapPos.x} y={zz.mapPos.y + 6.5} className="lv">Niv. {zz.levels[0]}–{zz.levels[1]}</text>
              </g>
            );
          })}
        </svg>
        <div className="wm-info">
          <h3>{z.name}</h3>
          <p>{z.desc}</p>
          <div className="kv"><span>Niveaux</span><b>{z.levels[0]} – {z.levels[1]}</b></div>
          <div className="kv"><span>Combat entre joueurs</span><b className={z.pvp === 'libre' ? 'war' : ''}>{z.pvp === 'libre' ? 'Libre (hors des ports)' : 'Sur consentement (pavillon rouge)'}</b></div>
          <div className="kv"><span>Ports</span><b>{z.ports.map((x) => x.name).join(', ')}</b></div>
          <div className="kv"><span>Ennemis</span><b>{enemies.map((f) => FACTION_LABEL[f]).join(', ')}</b></div>
          <div className="kv"><span>Îles</span><b>{z.islands}</b></div>
          <div className="kv"><span>Forts pirates</span><b>{z.pirateForts}</b></div>
          <div className="kv"><span>Épaves à fouiller</span><b>{z.wrecks}</b></div>
          <div className="kv"><span>Tempêtes</span><b>{z.storms > 0.6 ? 'Fréquentes' : z.storms > 0.3 ? 'Occasionnelles' : 'Rares'}</b></div>
          {sel === zone ? <p className="ok">Vous naviguez dans ces eaux.</p> : (
            <button className="btn-gold big" disabled={!docked || lvl < z.levels[0] - 1} onClick={() => send({ t: 'travel', zone: z.id })}>
              {!docked ? 'Voyage possible depuis un port' : lvl < z.levels[0] - 1 ? `Niveau ${z.levels[0] - 1} requis` : `Faire voile (${fmt(z.travelCost)} or)`}
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
}

export function Settings() {
  const s = useStore((st) => st.settings);
  const set = (patch: Partial<typeof s>) => { saveSettings({ ...s, ...patch }); game().applySettings(); };
  return (
    <Frame title="Paramètres" icon="reglages" onClose={close}>
      <div className="settings">
        <label>Qualité graphique
          <select value={s.quality} onChange={(e) => set({ quality: e.target.value as typeof s.quality })}>
            <option value="haute">Haute (ombres, halos, pleine résolution)</option>
            <option value="moyenne">Moyenne</option>
            <option value="basse">Basse (ordinateurs modestes)</option>
          </select>
        </label>
        <label>Volume <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={s.muted} onChange={(e) => set({ muted: e.target.checked })} /> Couper le son</label>
        <label className="check"><input type="checkbox" checked={s.autoCam} onChange={(e) => set({ autoCam: e.target.checked })} /> Caméra qui revient derrière le navire</label>
        <label className="check"><input type="checkbox" checked={s.labels} onChange={(e) => set({ labels: e.target.checked })} /> Afficher les noms au-dessus des navires</label>
        <button className="btn" onClick={() => { try { localStorage.removeItem('edm.token'); } catch { /* */ } location.reload(); }}>Se déconnecter</button>
      </div>
    </Frame>
  );
}

export function Help() {
  return (
    <Frame title="Manuel du capitaine" icon="aide" onClose={close}>
      <div className="help">
        <h4>Navigation</h4>
        <p><kbd>Z</kbd>/<kbd>S</kbd> (ou <kbd>↑</kbd>/<kbd>↓</kbd>) : augmenter ou réduire la voilure (4 allures). <kbd>Q</kbd>/<kbd>D</kbd> (ou <kbd>←</kbd>/<kbd>→</kbd>) : barre à bâbord / tribord. Le vent compte : vent de travers = allure la plus rapide, vent debout = très lent (flèche sur la rose des vents).</p>
        <h4>Combat</h4>
        <p>Vos canons tirent par le <b>flanc</b>. Visez avec la souris sur l'eau : l'arc et la cible apparaissent du côté choisi (or = prêt, rouge = rechargement, gris = hors d'angle). <b>Clic gauche</b> : bordée. <kbd>Espace</kbd> : les deux bords. <kbd>A</kbd>/<kbd>E</kbd> (QWERTY : <kbd>Q</kbd>/<kbd>E</kbd>) : bâbord/tribord. Relevez la caméra pour tirer plus loin.</p>
        <p>Munitions <kbd>1</kbd>–<kbd>5</kbd> : boulet rond, ramé (déchire les voiles), mitraille (courte portée, ralentit le rechargement adverse), boulet rouge (incendie), obus explosif. <kbd>R</kbd> kit de réparation, <kbd>F</kbd> éteindre un incendie, <kbd>G</kbd> poudre fine.</p>
        <h4>Ports</h4>
        <p>Approchez-vous d'un quai et appuyez sur <kbd>P</kbd> pour accoster : réparations, chantier naval, arsenal, améliorations, marché, missions et voyages vers d'autres mers. Les ports sont des zones protégées, défendues par des forts.</p>
        <h4>Multijoueur</h4>
        <p>Les autres capitaines sont de vrais joueurs. Les PNJ portent toujours la mention « PNJ ». En Manche et en Atlantique, le PvP se fait sur consentement : hissez le pavillon rouge (<kbd>B</kbd>). Dans le Golfe de Gascogne, les Caraïbes, l'océan Indien et la Mer des Brumes, le PvP est libre hors des ports. Guildes, alliances, guerres et groupes : touche <kbd>U</kbd>.</p>
        <h4>Événements</h4>
        <p>Régulièrement, « Le Spectre des Brumes » surgit dans chaque mer : un boss à affronter à plusieurs, récompenses partagées selon les dégâts. Les épaves cachent des coffres, les repaires pirates peuvent être réduits au silence.</p>
      </div>
    </Frame>
  );
}
