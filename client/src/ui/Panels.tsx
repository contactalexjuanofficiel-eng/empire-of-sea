// Panneaux : inventaire, profil, classement, guilde et groupe, carte du monde, paramètres, aide.
import { useEffect, useState } from 'react';
import { AMMO, AMMO_ORDER, CONSUMABLES, CONSUMABLE_ORDER, GOODS, MATERIAL_NAMES, type GoodId, type MaterialId } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import { levelFromXp, rankOf, reputationName, RANKS } from '../../../shared/progression';
import type { LeaderEntry } from '../../../shared/protocol';
import { computeStats, RARITY_COLOR, SHIP_BY_ID, SHIP_CLASSES } from '../../../shared/ships';
import { FACTION_LABEL, MAX_TIER, tierRequirement, ZONES, ZONE_BY_ID } from '../../../shared/zones';
import { saveSettings, store, useStore } from '../store';
import { EQUIP_NAME, EQUIP_ORDER } from '../../../shared/equipment';
import { FISH_RANKS, playerBonus, rankIndex, SHOOT_RANKS } from '../../../shared/extras';
import { defaultKeys, KEY_DEFS, keyLabel } from '../game/Input';
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
          <div className="inv-line"><Icon name="diamant" className="c-diamant" /> Diamants <b>{fmt(p.diamants ?? 0)}</b></div>
          <h3>Canons et mâts en stock</h3>
          {EQUIP_ORDER.filter((id) => (p.equip?.[id] ?? 0) > 0).map((id) => <div key={id} className="inv-line"><Icon name={id.startsWith('c') ? 'canon' : 'voile'} /> {EQUIP_NAME(id)} <b>{p.equip[id]}</b></div>)}
          {!EQUIP_ORDER.some((id) => (p.equip?.[id] ?? 0) > 0) && <p className="muted">Aucun.</p>}
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
  const st = computeStats(SHIP_BY_ID[ship.def], ship.up, p.skills, ship.fit, playerBonus(p).stat);
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
            <div>Grade de tir : <b>{SHOOT_RANKS[rankIndex(SHOOT_RANKS, p.shootXp)].name}</b> ({fmt(p.shootXp)} pts) · Grade de pêche : <b>{FISH_RANKS[rankIndex(FISH_RANKS, p.fishXp)].name}</b> ({fmt(p.fishXp)} pts)</div>
            <div>Points élite : <b>{fmt(p.elite)}</b> · Ferraille : <b>{fmt(p.ferraille)}</b></div>
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
  const p = useStore((s) => s.profile)!;
  const maps = useStore((s) => s.maps);
  const [sel, setSel] = useState(zone);
  const z = ZONE_BY_ID[sel] ?? ZONE_BY_ID[zone];
  const lvl = levelFromXp(p.xp).level;
  const info = (id: string) => maps.find((m) => m.id === id);
  const req = tierRequirement(p.tier);
  const enemies = [...new Set(z.enemies.map((e) => e.faction))];
  // Grille : rangées de 4, du bas (cartes débutantes) vers le haut.
  const rows: typeof ZONES[] = [];
  for (let i = 0; i < ZONES.length; i += 4) rows.push(ZONES.slice(i, i + 4));
  rows.reverse();
  return (
    <Frame title="Cartes" icon="carte" onClose={close} wide>
      <div className="maps">
        <div className="map-grid">
          {rows.map((row, ri) => (
            <div key={ri} className="map-row">
              {row.map((m) => {
                const locked = m.tier > p.tier;
                const inf = info(m.id);
                return (
                  <button key={m.id} className={`map-cell ${locked ? 'locked' : 'open'} ${m.id === zone ? 'here' : ''} ${m.id === sel ? 'sel' : ''} ${m.pvp === 'libre' ? 'war' : ''}`} onClick={() => setSel(m.id)}>
                    <span className="mc-owner">{inf?.owner ? `[${inf.owner}]` : ''}</span>
                    <span className="mc-code">{m.code}</span>
                    {m.id === zone && <span className="mc-here"><Icon name="profil" size={16} /></span>}
                    {!!inf?.players && <span className="mc-pl">{inf.players}</span>}
                    {locked && <span className="mc-lock">🔒</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="wm-info">
          <h3>Carte {z.code} — {z.name}</h3>
          <p>{z.desc}</p>
          <div className="kv"><span>Niveaux conseillés</span><b>{z.levels[0]} – {z.levels[1]}</b></div>
          <div className="kv"><span>Combat entre joueurs</span><b className={z.pvp === 'libre' ? 'war' : ''}>{z.pvp === 'libre' ? 'Libre (hors des ports)' : 'Sur consentement (pavillon rouge)'}</b></div>
          <div className="kv"><span>Ports</span><b>{z.ports.map((x) => x.name).join(', ')}</b></div>
          <div className="kv"><span>Ennemis</span><b>{enemies.map((f) => FACTION_LABEL[f]).join(', ')}</b></div>
          <div className="kv"><span>Récompenses</span><b>× {z.rewardMul.toFixed(2).replace('.', ',')}</b></div>
          <div className="kv"><span>Contrôlée par</span><b>{info(z.id)?.owner ? `[${info(z.id)!.owner}]` : 'Personne (vainquez le boss !)'}</b></div>
          {z.id === zone ? <p className="ok">Vous êtes sur cette carte.</p> : z.tier > p.tier ? (
            <p className="war">Verrouillée : accomplissez d'abord la mission de passage.</p>
          ) : (
            <button className="btn-gold big" onClick={() => send({ t: 'travel', zone: z.id })}>Aller sur la carte {z.code}</button>
          )}
          <div className="tier-box">
            <h4>Mission de passage — étage {p.tier}</h4>
            {p.tier >= MAX_TIER ? <p className="ok">Toutes les cartes sont débloquées. Respect, amiral !</p> : (
              <>
                <p className="muted small">Coulez des ennemis sur les cartes de votre étage le plus haut et atteignez le niveau requis pour débloquer la suivante.</p>
                <div className="ms-prog"><i style={{ width: `${Math.min(100, (p.tierKills / req.kills) * 100)}%` }} /><span>Navires coulés : {Math.min(p.tierKills, req.kills)} / {req.kills}</span></div>
                <div className={`kv ${lvl >= req.level ? 'ok' : ''}`}><span>Niveau requis</span><b>{lvl} / {req.level}</b></div>
              </>
            )}
          </div>
        </div>
      </div>
    </Frame>
  );
}

export function Settings() {
  const s = useStore((st) => st.settings);
  const [wait, setWait] = useState<string | null>(null);
  const set = (patch: Partial<typeof s>) => { saveSettings({ ...store.get().settings, ...patch }); game().applySettings(); };
  const rebind = (action: string) => {
    setWait(action);
    game().input.capture = (code) => {
      setWait(null);
      if (code === 'Escape') return;
      const keys = { ...store.get().settings.keys };
      for (const k of Object.keys(keys)) if (keys[k] === code) keys[k] = ''; // une touche = une action
      keys[action] = code;
      set({ keys });
    };
  };
  const groups = [...new Set(KEY_DEFS.map((k) => k.group))];
  return (
    <Frame title="Paramètres" icon="reglages" onClose={close} wide>
      <div className="settings">
        <div className="set-grid">
          <label className="check opt"><input type="checkbox" checked={s.autoAttack} onChange={(e) => set({ autoAttack: e.target.checked })} />
            <span><b>Attaque automatique</b><small>Un clic sur un ennemi le cible et lance l'attaque : votre navire manœuvre pour lui présenter le flanc et tire dès que les canons sont pointés. Désactivée, le clic ne fait que cibler (touche « Attaquer »).</small></span></label>
          <label className="opt"><span><b>Caméra</b><small>Vue du dessus (clic pour naviguer) ou vue 3D derrière le navire.</small></span>
            <select value={s.camMode} onChange={(e) => set({ camMode: e.target.value as typeof s.camMode })}>
              <option value="dessus">Vue du dessus</option>
              <option value="3d">Vue 3D derrière le navire</option>
            </select></label>
          <label className="opt"><span><b>Qualité graphique</b><small>Baissez-la si le jeu manque de fluidité.</small></span>
            <select value={s.quality} onChange={(e) => set({ quality: e.target.value as typeof s.quality })}>
              <option value="haute">Haute</option>
              <option value="moyenne">Moyenne</option>
              <option value="basse">Basse</option>
            </select></label>
          <label className="opt"><span><b>Volume</b></span><input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} /></label>
          <label className="check opt"><input type="checkbox" checked={s.muted} onChange={(e) => set({ muted: e.target.checked })} /><span><b>Couper le son</b></span></label>
          <label className="check opt"><input type="checkbox" checked={s.labels} onChange={(e) => set({ labels: e.target.checked })} /><span><b>Noms au-dessus des navires</b></span></label>
        </div>
        {groups.map((g) => (
          <section key={g}>
            <h4>{g}</h4>
            <div className="keys">
              {KEY_DEFS.filter((k) => k.group === g).map((k) => (
                <div key={k.action} className="keyrow">
                  <span>{k.label}</span>
                  <button className={`keybtn ${wait === k.action ? 'wait' : ''}`} onClick={() => rebind(k.action)}>{wait === k.action ? 'Appuyez…' : keyLabel(s.keys[k.action] ?? '')}</button>
                </div>
              ))}
            </div>
          </section>
        ))}
        <div className="row">
          <button className="btn" onClick={() => set({ keys: defaultKeys() })}>Touches par défaut</button>
          <button className="btn" onClick={() => { try { localStorage.removeItem('edm.token'); } catch { /* */ } location.reload(); }}>Se déconnecter</button>
        </div>
      </div>
    </Frame>
  );
}

export function Help() {
  return (
    <Frame title="Manuel du capitaine" icon="aide" onClose={close}>
      <div className="help">
        <h4>Navigation à la souris</h4>
        <p><b>Clic gauche sur la mer</b> : votre navire s'y rend seul en contournant les îles (repère vert). <b>Molette</b> : zoom. <b>Clic droit glissé</b> ou touches caméra : déplacer la vue, <b>9</b> pour recentrer. La vue 3D derrière le navire se choisit dans les Paramètres (touche V).</p>
        <h4>Combat</h4>
        <p><b>Clic gauche sur un ennemi</b> : il est ciblé (anneau) et, avec l'attaque automatique, votre navire manœuvre pour lui présenter le flanc et tire dès que les canons sont pointés. Touche « Attaquer » / « Annuler l'attaque » pour la cible sélectionnée. La barre rapide (1 à 8) change de munition ou utilise réparation, pompes et poudre fine.</p>
        <p>Toutes les touches se règlent dans <b>Paramètres</b>. Les flèches du clavier permettent aussi de barrer à la main.</p>
        <h4>Cartes</h4>
        <p>Les cartes 1/1 à 5/2 vont par paires (/1 calme, /2 de guerre), puis viennent les cartes 11 à 20. Chaque carte a ses ports. Coulez des ennemis sur votre étage le plus haut et atteignez le niveau requis pour débloquer le suivant (fenêtre Cartes, touche M).</p>
        <h4>Équipement</h4>
        <p>Au port, onglet Équipement : installez canons de 30, 50 et 60 livres et mâts dans la limite de capacité du navire. Ils s'achètent à l'Arsenal (or, perles, diamants) et se trouvent dans le butin des PNJ.</p>
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
