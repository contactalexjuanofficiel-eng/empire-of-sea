// Interface en mer (MMORPG naval) :
// haut = niveau, expérience, monnaies, ressources et commandes ; gauche = journal (missions, objectifs, événements) ;
// droite = mini-carte, cible, navires proches ; bas = vie, bouclier, énergie, munitions, compétences, combat.
import { useEffect, useState } from 'react';
import { AMMO, AMMO_ORDER, CONSUMABLES, CONSUMABLE_ORDER } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import { levelFromXp } from '../../../shared/progression';
import { DAILY, levelMission } from '../../../shared/extras';
import { ACTIVE_SKILLS, ENERGY_MAX } from '../../../shared/combat';
import { BONUS_ZONES } from '../../../shared/zones';
import { GRADES } from '../../../shared/ranks';
import { ROLES, SHIP_BY_ID, shipRole } from '../../../shared/ships';
import { FACTION_LABEL, tierRequirement, ZONE_BY_ID } from '../../../shared/zones';
import { keyLabel } from '../game/Input';
import { askConfirm, store, useStore, type Panel } from '../store';
import { game, Icon, Price, send } from './common';
import { TUTORIAL } from '../../../shared/tutorial';
import { Minimap } from './Hud';

const togglePanel = (p: Panel) => store.set((s) => ({ panel: s.panel === p ? (s.docked ? 'port' : null) : p }));

/** Barre du haut : ressources à gauche, grands boutons au centre, images/s et latence à droite. */
export function TopNav() {
  const p = useStore((s) => s.profile);
  const panel = useStore((s) => s.panel);
  const docked = useStore((s) => s.docked);
  const fps = useStore((s) => s.fps);
  const ping = useStore((s) => s.ping);
  const conn = useStore((s) => s.connection);
  const [menu, setMenu] = useState(false);
  if (!p) return null;
  const lv = levelFromXp(p.xp);
  const btn = (id: string, icon: string, label: string, on: boolean, act: () => void, extra = '') => (
    <button key={id} className={`tn-btn ${on ? 'on' : ''} ${extra}`} onClick={() => { setMenu(false); act(); }}>
      <Icon name={icon} size={22} /><span>{label}</span>
    </button>
  );
  const menuItems: [Panel, string, string][] = [
    ['inventaire', 'sac', 'Inventaire'], ['profil', 'profil', 'Profil du capitaine'], ['capitaines', 'epee', 'Capitaines'],
    ['rangs', 'etoile', 'Rangs et grades'], ['flotte', 'ancre', 'Flotte moderne'], ['guilde', 'guilde', 'Guilde & groupe'],
    ['carte', 'carte', 'Cartes'], ['aide', 'aide', 'Aide'], ['parametres', 'reglages', 'Paramètres'],
  ];
  return (
    <div className="topnav">
      <div className="tn-level" title={`${fmt(lv.into)} / ${fmt(lv.need)} XP`}>
        <span className="tn-lv">{lv.level}</span>
        <div className="tn-xp-wrap">
          <span className="tn-name">{p.name}</span>
          <div className="tn-xp"><i style={{ width: `${lv.need ? (lv.into / lv.need) * 100 : 100}%` }} /><span>{lv.need ? `${fmt(lv.into)} / ${fmt(lv.need)} XP` : 'Niveau max'}</span></div>
        </div>
      </div>
      <div className="tn-res">
        <span title="Pièces d'or"><Icon name="or" className="c-or" size={15} />{fmt(p.or)}</span>
        <span title="Doublons"><Icon name="doublon" className="c-doublon" size={15} />{fmt(p.doublons)}</span>
        <span title="Perles"><Icon name="perle" className="c-perle" size={15} />{fmt(p.perles)}</span>
        <span title="Diamants"><Icon name="diamant" className="c-diamant" size={15} />{fmt(p.diamants ?? 0)}</span>
        <span className="tn-mats" title="Bois · Toile · Fer · Ferraille"><Icon name="bois" size={14} />{fmt(p.mat.bois)}<Icon name="toile" size={14} />{fmt(p.mat.toile)}<Icon name="fer" size={14} />{fmt(p.mat.fer)}</span>
      </div>
      <nav className="tn-btns">
        <div className="tn-menu-wrap">
          {btn('menu', 'parchemin', 'Menu', menu, () => setMenu((m) => !m))}
          {menu && (
            <div className="tn-menu" onMouseLeave={() => setMenu(false)}>
              {menuItems.map(([id, icon, label]) => (
                <button key={id} className={panel === id ? 'on' : ''} onClick={() => { setMenu(false); togglePanel(id); }}><Icon name={icon} size={16} /> {label}</button>
              ))}
            </div>
          )}
        </div>
        {btn('port', 'ancre', 'Port', panel === 'port', () => game().goToPort())}
        {btn('missions', 'parchemin', 'Missions', panel === 'missions', () => togglePanel('missions'))}
        {btn('bonus', 'etoile', 'Cartes bonus', panel === 'bonus', () => togglePanel('bonus'))}
        {btn('boutique', 'coffre', 'Boutique', panel === 'boutique', () => togglePanel('boutique'), 'gold')}
        {btn('evenement', 'drapeau', 'Événement', panel === 'evenement', () => togglePanel('evenement'))}
        {btn('classement', 'trophee', 'Classements', panel === 'classement', () => togglePanel('classement'))}
        {btn('tableau', 'profil', 'Tableau', panel === 'profil', () => togglePanel('profil'))}
        {btn('sortie', 'porte', 'Sortie', false, () => {
          askConfirm('Quitter la partie et revenir à l\'écran de connexion ?', () => {
            try { localStorage.removeItem('edm.token'); } catch { /* stockage indisponible */ }
            location.reload();
          });
        }, 'exit')}
      </nav>
      <div className={`tn-perf net-${conn}`}>
        <span>{fps} i/s</span>
        <span>{conn === 'on' ? `${ping} ms` : conn === 'lost' ? 'hors ligne' : '…'}</span>
        {docked && <span className="tn-docked">au port</span>}
      </div>
    </div>
  );
}

/** Graduations des secteurs sur les bords de l'écran (numéros en haut, lettres à gauche). */
export function Rulers() {
  const mode = useStore((s) => s.settings.camMode);
  const [g, setG] = useState<ReturnType<ReturnType<typeof game>['screenGrid']> | null>(null);
  useEffect(() => {
    const id = setInterval(() => setG(game().screenGrid()), 80);
    return () => clearInterval(id);
  }, []);
  if (mode !== 'dessus' || !g) return null;
  return (
    <>
      <div className="ruler ruler-top">{g.cols.map((c) => <span key={c.label} style={{ left: c.px }}>{c.label}</span>)}</div>
      <div className="ruler ruler-left">{g.rows.map((r) => <span key={r.label} style={{ top: r.px }}>{r.label}</span>)}</div>
    </>
  );
}

/** Cadre de la cible, en haut à gauche. */
export function TargetCard() {
  const t = useStore((s) => s.target);
  const attacking = useStore((s) => s.attacking);
  if (!t) return null;
  const def = t.ship ? SHIP_BY_ID[t.ship] : undefined;
  return (
    <div className={`tcard ${t.hostile ? 'ennemi' : ''} ${attacking ? 'attacking' : ''}`}>
      <div className="tc-ico"><Icon name={t.kind === 'player' ? 'profil' : t.kind === 'fort' ? 'guilde' : def?.look.monster ? 'crane' : 'ancre'} size={26} /><span className="tc-lv">{t.level}</span></div>
      <div className="tc-main">
        <div className="tc-name">{t.name}{t.kind !== 'player' && <em> (PNJ)</em>}</div>
        <div className="tc-sub">{t.kind === 'player' ? 'Capitaine' : FACTION_LABEL[t.faction as keyof typeof FACTION_LABEL] ?? ''}{def ? ` · ${def.name}` : ''} · {Math.round(t.dist)} m</div>
        {def && !def.look.monster && <div className="tc-role" style={{ color: ROLES[shipRole(def)].color }}>{ROLES[shipRole(def)].name}</div>}
        <div className="tc-hp"><i style={{ width: `${t.hp * 100}%` }} /><span>{Math.round(t.hp * 100)} %</span></div>
      </div>
      {attacking ? <button className="tc-act stop" onClick={() => game().cancelAttack()} title="Cesser le feu">✕</button>
        : <button className="tc-act" onClick={() => game().attack(t.id)} title="Attaquer"><Icon name="epee" size={16} /></button>}
    </div>
  );
}

/** Mini-carte avec boutons ronds, et la ligne « (joueurs) carte  secteur  ancre ». */
export function MapBlock() {
  const zone = useStore((s) => s.zone);
  const maps = useStore((s) => s.maps);
  const chatOpen = useStore((s) => s.chatOpen);
  const [sector, setSector] = useState('');
  useEffect(() => {
    const id = setInterval(() => setSector(game().screenGrid().sector), 250);
    return () => clearInterval(id);
  }, []);
  const z = ZONE_BY_ID[zone];
  const n = maps.find((m) => m.id === zone)?.players ?? 1;
  return (
    <div className="mapblock">
      <div className="mb-round">
        <button className={chatOpen ? 'on' : ''} onClick={() => store.set({ chatOpen: !chatOpen })} title="Afficher / masquer la discussion"><Icon name="parchemin" size={16} /></button>
        <button onClick={() => togglePanel('carte')} title="Cartes du monde"><Icon name="globe" size={16} /></button>
        <button onClick={() => togglePanel('parametres')} title="Paramètres"><Icon name="reglages" size={16} /></button>
      </div>
      <div className="mb-main">
        <Minimap />
        <div className={`mb-line ${z?.pvp === 'libre' ? 'war' : ''}`}>
          <span className="mb-pl" title="Capitaines sur cette carte">({n})</span>
          <button className="mb-code" onClick={() => togglePanel('carte')} title={z?.name}>{z?.code}</button>
          <span className="mb-sector" title="Votre secteur (colonne, rangée)">{sector}</span>
          <button className="mb-anchor" onClick={() => game().goToPort()} title="Ouvrir le port (chantier, arsenal, équipement…)"><Icon name="ancre" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

type SideTab = 'espion' | 'groupe' | 'tableau';

/** Onglets de droite : navires à proximité, groupe, tableau (bilan). */
export function SideTabs() {
  const [tab, setTab] = useState<SideTab>('espion');
  const [open, setOpen] = useState(true);
  const tabs: [SideTab, string][] = [['espion', 'À proximité'], ['groupe', 'Groupe'], ['tableau', 'Tableau']];
  return (
    <div className={`sidetabs ${open ? '' : 'closed'}`}>
      <div className="st-tabs">
        {tabs.map(([id, label]) => <button key={id} className={tab === id && open ? 'on' : ''} onClick={() => { setTab(id); setOpen(tab !== id || !open); }}>{label}</button>)}
      </div>
      {open && (
        <div className="st-body">
          {tab === 'espion' && <TabSpy />}
          {tab === 'groupe' && <TabGroup />}
          {tab === 'tableau' && <TabBoard />}
        </div>
      )}
    </div>
  );
}

type JournalTab = 'missions' | 'objectifs' | 'evenements';

/** Journal de bord (gauche) : missions en cours, objectifs de progression, événements du moment. */
export function Journal() {
  const [tab, setTab] = useState<JournalTab>('missions');
  const [open, setOpen] = useState(true);
  const tabs: [JournalTab, string][] = [['missions', 'Missions'], ['objectifs', 'Objectifs'], ['evenements', 'Événements']];
  return (
    <div className={`journal ${open ? '' : 'closed'}`}>
      <div className="jr-head">
        <Icon name="parchemin" size={15} /><b>Journal de bord</b>
        <button onClick={() => setOpen(!open)} title={open ? 'Replier' : 'Déplier'}>{open ? '−' : '+'}</button>
      </div>
      {open && (
        <>
          <div className="st-tabs three">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
          <div className="st-body">
            {tab === 'missions' && <TabMissions />}
            {tab === 'objectifs' && <TabGoals />}
            {tab === 'evenements' && <TabEvents />}
          </div>
        </>
      )}
    </div>
  );
}

function Prog({ v, max, label }: { v: number; max: number; label?: string }) {
  return <div className="st-prog"><i style={{ width: `${Math.min(100, (v / Math.max(1, max)) * 100)}%` }} /><span>{label ?? `${fmt(v)} / ${fmt(max)}`}</span></div>;
}

function TabMissions() {
  const p = useStore((s) => s.profile)!;
  const none = !p.daily.active.length && !p.missions.length;
  return (
    <>
      {p.daily.active.map((d) => (
        <div key={d.id} className="st-item"><b>{DAILY.find((x) => x.id === d.id)?.name}</b><Prog v={d.progress} max={d.goal} /></div>
      ))}
      {p.missions.map((m) => (
        <div key={m.id} className="st-item"><b>{m.title}</b><Prog v={m.progress} max={m.goal} /></div>
      ))}
      {none && <p className="st-empty">Aucune mission en cours.</p>}
      <button className="st-link" onClick={() => togglePanel('missions')}>Missions quotidiennes…</button>
    </>
  );
}

function TabGoals() {
  const p = useStore((s) => s.profile)!;
  const lvl = levelFromXp(p.xp).level;
  const lm = levelMission(lvl);
  const lmProg = p.levelMission.level === lvl ? p.levelMission.progress : 0;
  const req = tierRequirement(p.tier);
  return (
    <>
      <div className="st-item"><b>Mission de niveau {lvl}</b><Prog v={lmProg} max={lm.goal} label={`Navires coulés : ${lmProg} / ${lm.goal}`} /></div>
      <div className="st-item"><b>Mission de passage — étage {p.tier}</b><Prog v={p.tierKills} max={req.kills} label={`${Math.min(p.tierKills, req.kills)} / ${req.kills} · niveau ${req.level} requis`} /></div>
      <div className="st-item"><b>Prochain niveau</b><Prog v={levelFromXp(p.xp).into} max={levelFromXp(p.xp).need} /></div>
    </>
  );
}

/** Raid PvP : état, compte à rebours, points des guildes. */
export function RaidBox() {
  const raid = useStore((s) => s.raid);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!raid) return null;
  const z = ZONE_BY_ID[raid.zone];
  const mmss = (ms: number) => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
  return (
    <div className={`st-item ev raid ${raid.state === 'actif' ? 'hot' : ''}`}>
      <b>⚔ Raid de guildes — carte {z?.code}</b>
      <p className="st-empty">{raid.state === 'actif' ? `En cours : fin dans ${mmss(raid.end - now)}` : `${raid.state === 'annonce' ? 'Annoncé ! ' : ''}Début dans ${mmss(raid.start - now)} (${z?.name})`}</p>
      {raid.scores.slice(0, 3).map((x, i) => <div key={x.tag} className="st-row"><span>{i + 1}. [{x.tag}]</span><b className="num">{x.points} pts</b></div>)}
      {raid.state !== 'prevu' && <button className="st-link" onClick={() => send({ t: 'travel', zone: raid.zone })}>Rejoindre le raid</button>}
    </div>
  );
}

function TabEvents() {
  const boss = useStore((s) => s.boss);
  const maps = useStore((s) => s.maps);
  const bonusOpen = BONUS_ZONES.some((z) => maps.find((m) => m.id === z.id)?.open);
  return (
    <>
      <RaidBox />
      <div className={`st-item ev ${boss.active ? 'hot' : ''}`}>
        <b>Boss de la carte</b>
        {boss.active ? <Prog v={boss.hp ?? 0} max={boss.maxHp ?? 1} label={`${boss.name} · ${fmt(boss.hp ?? 0)}`} /> : <p className="st-empty">Aucun boss en mer.</p>}
      </div>
      <div className={`st-item ev ${bonusOpen ? 'hot' : ''}`}>
        <b>Cartes bonus</b>
        <p className="st-empty">{bonusOpen ? 'Ouvertes aujourd\'hui !' : 'Ouvertes le dimanche.'}</p>
      </div>
      <button className="st-link" onClick={() => togglePanel('evenement')}>Tous les événements…</button>
    </>
  );
}

function TabSpy() {
  const list = useStore((s) => s.nearby);
  if (!list.length) return <p className="st-empty">Aucun navire en vue.</p>;
  return (
    <>
      {list.map((n) => (
        <button key={n.id} className={`st-ship ${n.friend ? 'ami' : n.hostile ? 'ennemi' : ''}`} onClick={() => game().attack(n.id)} title={n.hostile ? 'Attaquer' : 'Sélectionner'}>
          <span className="nb-lv">{n.level}</span>
          <span className="st-sname">{n.kind === 'player' ? `${n.tag ? `[${n.tag}] ` : ''}${n.name}` : `${n.name} (PNJ)`}</span>
          <span className="st-d">{Math.round(n.dist)} m</span>
          <span className="st-hp"><i style={{ width: `${n.hp * 100}%` }} /></span>
        </button>
      ))}
    </>
  );
}

function TabGroup() {
  const group = useStore((s) => s.group);
  const me = useStore((s) => s.name);
  const [name, setName] = useState('');
  return (
    <>
      {group.members.length ? group.members.map((m) => <div key={m} className="st-row"><span>{m}</span>{group.leader === m && <em>chef</em>}</div>) : <p className="st-empty">Vous naviguez seul.</p>}
      {group.members.length > 1 && (me === group.leader
        ? <p className="st-empty">Vous menez l'escadre : vos capitaines peuvent vous suivre en formation.</p>
        : <button className={`btn small fleet-btn ${group.follow ? 'on' : ''}`} onClick={() => send({ t: 'fleet', follow: !group.follow })}>{group.follow ? 'Quitter la formation' : `Suivre ${group.leader} en escadre`}</button>)}
      {group.members.length > 1 && <p className="st-empty small">Bonus d'escadre : +5 % de dégâts par allié à moins de 500 m (3 au maximum).</p>}
      {group.invite && <div className="st-row"><span>{group.invite} vous invite</span><button className="btn-gold small" onClick={() => send({ t: 'group', a: 'accept' })}>Accepter</button></div>}
      <form className="st-inv" onSubmit={(e) => { e.preventDefault(); if (name.trim()) send({ t: 'group', a: 'invite', name: name.trim() }); setName(''); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du capitaine" maxLength={16} />
        <button className="btn small">Inviter</button>
      </form>
      {group.members.length > 0 && <button className="st-link" onClick={() => send({ t: 'group', a: 'leave' })}>Quitter le groupe</button>}
    </>
  );
}

function TabBoard() {
  const p = useStore((s) => s.profile)!;
  const g = useStore((s) => s.grade);
  const st = p.stats;
  const rows: [string, string][] = [
    ['Grade', GRADES[g?.grade ?? GRADES.length - 1].name], ['Navires coulés', fmt(st.kills)], ['Capitaines coulés', fmt(st.pvp)],
    ['Naufrages', fmt(st.deaths)], ['Dégâts infligés', fmt(st.damage)], ['Trésors', fmt(st.treasures)], ['Points élite', fmt(p.elite)],
  ];
  return <>{rows.map(([k, v]) => <div key={k} className="st-row"><span>{k}</span><b>{v}</b></div>)}</>;
}

const ITEM_ICON: Record<string, string> = { kit: 'marteau', seau: 'seau', poudre: 'poudre', reparation: 'marteau', vitesse: 'vent', harpon_bronze: 'epee', harpon_argent: 'epee', harpon_or: 'epee', feu_gregeois: 'feu', brulot: 'feu', bouclier: 'guilde', corne: 'drapeau', fumigene: 'vent', lanterne: 'etoile', parchemin: 'parchemin', coffre_amiral: 'coffre' };

/** Bas de l'écran : vie, bouclier, énergie ; munitions, compétences, objets ; boutons de combat. */
export function BottomDock() {
  const hud = useStore((s) => s.hud);
  const p = useStore((s) => s.profile);
  const keys = useStore((s) => s.settings.keys);
  const target = useStore((s) => s.target);
  const attacking = useStore((s) => s.attacking);
  if (!p) return null;
  const ship = SHIP_BY_ID[p.ships.find((x) => x.uid === p.active)?.def ?? 'bayonnaise'];
  const lvl = levelFromXp(p.xp).level;
  const hpR = hud.hp / Math.max(1, hud.maxHp);
  const ready = hud.reload[0] <= 0.05;
  const r = 1 - Math.min(1, hud.reload[0] / Math.max(0.1, hud.reloadMax * 0.65));
  const owned = CONSUMABLE_ORDER.filter((id) => (p.items[id] ?? 0) > 0);
  const boosts = [hud.boost.dmg > 0 && `Bordée +30 % · ${Math.ceil(hud.boost.dmg)} s`, hud.boost.crit > 0 && `Précision · ${Math.ceil(hud.boost.crit)} s`, hud.boost.speed > 0 && `Vitesse · ${Math.ceil(hud.boost.speed)} s`, hud.boost.shield > 0 && `Airain · ${Math.ceil(hud.boost.shield)} s`, hud.powder > 0 && `Poudre fine · ${Math.ceil(hud.powder)} s`, hud.fleet > 0 && `Escadre +${hud.fleet * 5} % dégâts`, hud.raid && '⚔ Raid en cours : combat libre'].filter(Boolean) as string[];
  return (
    <div className="bdock">
      {boosts.length > 0 && <div className="bd-boosts">{boosts.map((b) => <span key={b}>{b}</span>)}</div>}
      <div className="bd-bars">
        <div className={`bd-bar hp ${hpR < 0.3 ? 'low' : ''}`} title="Coque (points de vie)">
          <i style={{ width: `${hpR * 100}%` }} />
          <span>{ship.name} — {fmt(hud.hp)} / {fmt(hud.maxHp)}{hud.burning ? ' · en feu !' : ''}{hud.repairing ? ' · réparations' : ''}</span>
        </div>
        <div className="bd-bar shield" title="Bouclier : encaisse les dégâts avant la coque, se recharge 6 s après le dernier coup reçu">
          <i style={{ width: `${hud.shieldMax ? (hud.shield / hud.shieldMax) * 100 : 0}%` }} />
          <span>Bouclier {fmt(hud.shield)} / {fmt(hud.shieldMax)}</span>
        </div>
        <div className="bd-bar energy" title="Énergie : sert à lancer les compétences, se régénère en continu">
          <i style={{ width: `${(hud.energy / ENERGY_MAX) * 100}%` }} />
          <span>Énergie {hud.energy} / {ENERGY_MAX}</span>
        </div>
      </div>
      <div className="bd-main">
        <div className="bd-rows">
          <div className="bd-row">
            <button className={`bd-fire ${ready ? 'ready' : ''}`} onClick={() => game().fire()} title={`Tirer une salve vers la cible (${keyLabel(keys.fireBoth)})`}>
              <span className="bd-fire-bar" style={{ height: `${r * 100}%` }} />
              <Icon name="canon" size={18} />
              <small>{ready ? 'Feu !' : `${hud.reload[0].toFixed(1)}`}</small>
            </button>
            {AMMO_ORDER.map((id, i) => {
              const a = AMMO[id];
              const n = id === 'rond' ? '∞' : fmt(p.ammo[id] ?? 0);
              return (
                <button key={id} className={`hk ammo-${id} ${hud.ammo === id ? 'on' : ''} ${n === '0' ? 'empty' : ''}`} onClick={() => game().selectAmmo(id)} title={`${a.name} — ${a.desc}`}>
                  <span className="k">{keyLabel(keys[`hot${i + 1}`])}</span>
                  <span className="ball" />
                  <span className="q">{n}</span>
                </button>
              );
            })}
            <button className={`hk fish ${hud.fishing ? 'on' : ''}`} onClick={() => send({ t: 'fish', on: !hud.fishing })} title={`Pêcher (${keyLabel(keys.fish)}) : navire à l'arrêt, hors des ports`}>
              <span className="k">{keyLabel(keys.fish)}</span><span className="fish-ico">🎣</span>
            </button>
          </div>
          <div className="bd-row">
            {ACTIVE_SKILLS.map((sk, i) => {
              const cd = hud.skillCd[sk.id] ?? 0;
              const locked = lvl < sk.level;
              const noEnergy = hud.energy < sk.energy;
              return (
                <button key={sk.id} className={`hk skill ${locked ? 'locked' : ''} ${cd > 0 ? 'cool' : ''} ${noEnergy && !cd ? 'low' : ''}`} onClick={() => game().useSkill(sk.id)} title={`${sk.name} — ${sk.desc} Énergie ${sk.energy} · recharge ${sk.cooldown} s${locked ? ` · niveau ${sk.level} requis` : ''}`}>
                  <span className="k">{keyLabel(keys[`skill${i + 1}`])}</span>
                  <Icon name={sk.icon} size={18} />
                  <span className="q">{locked ? `N${sk.level}` : sk.energy}</span>
                  {cd > 0 && <span className="cdv">{Math.ceil(cd)}</span>}
                </button>
              );
            })}
            <span className="bd-sep" />
            {Array.from({ length: 4 }, (_, ci) => {
              const id = owned[ci];
              if (!id) return <span key={ci} className="hk vide" />;
              const c = CONSUMABLES[id];
              const cd = hud.cd[id] ?? 0;
              return (
                <button key={id} className={`hk cons ${cd > 0 ? 'cool' : ''}`} onClick={() => game().useItem(id)} title={`${c.name} — ${c.desc}`}>
                  <span className="k">{ci < 3 ? keyLabel(keys[`hot${8 + ci}`]) : ''}</span>
                  <Icon name={ITEM_ICON[id] ?? 'coffre'} size={18} />
                  <span className="q">{p.items[id] ?? 0}</span>
                  {cd > 0 && <span className="cdv">{Math.ceil(cd)}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bd-combat">
          {attacking ? <button className="cb stop" onClick={() => game().cancelAttack()} title={`Cesser le feu (${keyLabel(keys.cancelAttack)})`}>Cesser le feu</button>
            : <button className="cb attack" disabled={!target?.hostile} onClick={() => target && game().attack(target.id)} title={`Attaquer la cible (${keyLabel(keys.attack)})`}>Attaquer</button>}
          <button className={`cb ${hud.hp < hud.maxHp * 0.999 ? 'dock' : ''}`} onClick={() => send({ t: 'shop', a: 'repair' })} title="Réparer coque et voiles (hors combat, payant)">Réparer</button>
        </div>
      </div>
    </div>
  );
}

/** Encart du tutoriel : étape en cours, progression, récompense, bouton pour passer. */
export function TutorialBox() {
  const p = useStore((s) => s.profile);
  if (!p || p.tutorial >= TUTORIAL.length) return null;
  const st = TUTORIAL[p.tutorial];
  return (
    <div className="tuto" role="status">
      <div className="tuto-head">
        <span className="tuto-step num">{p.tutorial + 1} / {TUTORIAL.length}</span>
        <b>{st.title}</b>
        <button className="tuto-skip" onClick={() => askConfirm('Passer le tutoriel ? Vous ne recevrez pas les récompenses des étapes restantes.', () => send({ t: 'tuto', a: 'skip' }))}>Passer</button>
      </div>
      <p>{st.text}</p>
      <div className="tuto-pips">{TUTORIAL.map((_, i) => <i key={i} className={i < p.tutorial ? 'done' : i === p.tutorial ? 'on' : ''} />)}</div>
      <div className="tuto-reward">Récompense : <Price p={{ or: st.reward.or, perles: st.reward.perles }} /> · <span className="num">{st.reward.xp} XP</span></div>
    </div>
  );
}
