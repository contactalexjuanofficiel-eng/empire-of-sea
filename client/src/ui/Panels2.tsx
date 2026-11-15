// Fenêtres de la deuxième livraison : missions, boutique, capitaines, cartes bonus, matelot de pont, navires élites.
import { useEffect, useState } from 'react';
import { CAPTAIN_CATS, CAPTAINS, DAILY, DAILY_SLOTS, FORGE, levelMission, SKINS, type SkinId } from '../../../shared/extras';
import { CONSUMABLE_ORDER, CONSUMABLES, ITEM_CATS } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import { levelFromXp } from '../../../shared/progression';
import { computeStats, ELITE_SHIPS, RARITY_COLOR, SHIP_CLASSES } from '../../../shared/ships';
import { BONUS_ZONES, MAX_TIER, tierRequirement, ZONE_BY_ID } from '../../../shared/zones';
import { store, useStore } from '../store';
import { Frame, Icon, Price, send, StatBar } from './common';

const close = () => store.set((s) => ({ panel: s.docked ? 'port' : null }));
const ITEM_ICON: Record<string, string> = { kit: 'marteau', seau: 'seau', poudre: 'poudre', reparation: 'marteau', vitesse: 'vent', harpon_bronze: 'epee', harpon_argent: 'epee', harpon_or: 'epee', feu_gregeois: 'feu', brulot: 'feu', bouclier: 'guilde', corne: 'drapeau', fumigene: 'vent', lanterne: 'etoile', parchemin: 'parchemin', coffre_amiral: 'coffre' };

function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const hm = (ms: number) => { const m = Math.ceil(ms / 60000); return `${Math.floor(m / 60)} h ${m % 60} min`; };

// ------------------------------------------------------------------ Missions
export function MissionsPanel() {
  const p = useStore((s) => s.profile)!;
  const zone = ZONE_BY_ID[useStore((s) => s.zone)];
  const [tab, setTab] = useState<'quotidiennes' | 'niveau'>('quotidiennes');
  const [sel, setSel] = useState(DAILY[0].id);
  const now = useNow();
  const tier = Math.max(1, zone?.tier || p.tier);
  const d = DAILY.find((x) => x.id === sel)!;
  const active = p.daily.active.find((a) => a.id === sel);
  const cd = (p.daily.cooldown[sel] ?? 0) - now;
  const rw = d.reward(active?.tier ?? tier);
  const lvl = levelFromXp(p.xp).level;
  const lm = levelMission(lvl);
  const lmProg = p.levelMission.level === lvl ? p.levelMission.progress : 0;
  const req = tierRequirement(p.tier);
  return (
    <Frame title="Missions" icon="parchemin" onClose={close} wide>
      <div className="eq-tabs">
        <button className={`btn ${tab === 'quotidiennes' ? 'on' : ''}`} onClick={() => setTab('quotidiennes')}>Missions quotidiennes</button>
        <button className={`btn ${tab === 'niveau' ? 'on' : ''}`} onClick={() => setTab('niveau')}>Missions de niveau</button>
      </div>
      {tab === 'quotidiennes' ? (
        <div className="daily">
          <div className="daily-list">
            {DAILY.map((x) => {
              const a = p.daily.active.find((y) => y.id === x.id);
              const wait = (p.daily.cooldown[x.id] ?? 0) > now;
              return <button key={x.id} className={`daily-btn ${sel === x.id ? 'on' : ''} ${a ? 'active' : wait ? 'wait' : ''}`} onClick={() => setSel(x.id)}>{x.name}</button>;
            })}
          </div>
          <div className="daily-detail">
            <h4>Statut de mission</h4>
            <p>{d.desc.replace('{n}', fmt(active?.goal ?? d.goal(tier)))}</p>
            {active && <div className="ms-prog"><i style={{ width: `${(active.progress / active.goal) * 100}%` }} /><span>{fmt(active.progress)} / {fmt(active.goal)}</span></div>}
            <h4>Récompenses</h4>
            <p className="m-reward"><Price p={{ or: rw.or, perles: rw.perles, diamants: rw.diamants }} /> · {fmt(rw.xp)} XP</p>
            <p className="muted small">Objectifs et récompenses selon l'étage de la carte où vous lancez la mission. Une mission accomplie revient 12 heures plus tard. {DAILY_SLOTS} mission active à la fois.</p>
            <div className="row">
              {active ? <button className="btn danger" onClick={() => send({ t: 'daily', a: 'abandon', id: sel })}>Abandonner</button>
                : cd > 0 ? <span className="war">Temps d'attente : {hm(cd)}</span>
                : <button className="btn-gold big" onClick={() => send({ t: 'daily', a: 'start', id: sel })}>Lancer la mission</button>}
            </div>
          </div>
        </div>
      ) : (
        <div className="cap">
          <section>
            <h3>Mission de niveau {lvl}</h3>
            <p>Coulez {lm.goal} ennemis de niveau {lm.minLevel} ou plus pour gagner une grosse part de l'expérience du niveau suivant.</p>
            <div className="ms-prog"><i style={{ width: `${(lmProg / lm.goal) * 100}%` }} /><span>{lmProg} / {lm.goal}</span></div>
            <p className="m-reward">Récompense : {Math.round(lm.xpShare * 100)} % du niveau en XP · {fmt(lm.or)} or · 1 perle</p>
          </section>
          <section>
            <h3>Mission de passage — étage {p.tier}</h3>
            {p.tier >= MAX_TIER ? <p className="ok">Toutes les cartes sont débloquées.</p> : (
              <>
                <p>Coulez des ennemis sur vos cartes les plus hautes et atteignez le niveau requis pour débloquer les suivantes.</p>
                <div className="ms-prog"><i style={{ width: `${Math.min(100, (p.tierKills / req.kills) * 100)}%` }} /><span>{Math.min(p.tierKills, req.kills)} / {req.kills}</span></div>
                <div className={`kv ${lvl >= req.level ? 'ok' : ''}`}><span>Niveau requis</span><b>{lvl} / {req.level}</b></div>
              </>
            )}
          </section>
        </div>
      )}
    </Frame>
  );
}

// ------------------------------------------------------------------ Boutique
export function ShopPanel() {
  const p = useStore((s) => s.profile)!;
  const [qty, setQty] = useState<Record<string, number>>({});
  return (
    <Frame title="Boutique de l'Amirauté" icon="coffre" onClose={close} wide>
      <p className="muted">Objets puissants utilisables en mer depuis la deuxième barre rapide. Achat possible partout, même en pleine bataille.</p>
      {ITEM_CATS.map((cat) => (
        <section key={cat.id}>
          <h4>{cat.name}</h4>
          <div className="shop-grid">
            {CONSUMABLE_ORDER.filter((id) => CONSUMABLES[id].cat === cat.id).map((id) => {
              const it = CONSUMABLES[id];
              const q = qty[id] ?? 1;
              return (
                <div key={id} className="shop-card">
                  <div className="sc-ico"><Icon name={ITEM_ICON[id] ?? 'coffre'} size={34} /><span>{p.items[id] ?? 0}</span></div>
                  <div className="sc-txt"><b>{it.name}</b><small>{it.desc}</small>{it.cooldown > 1 && <small className="muted">Recharge : {it.cooldown >= 60 ? `${Math.round(it.cooldown / 60)} min` : `${it.cooldown} s`}{it.target ? ' · sur la cible sélectionnée' : ''}</small>}</div>
                  <div className="sc-buy">
                    <Price p={{ or: (it.price.or ?? 0) * q, perles: (it.price.perles ?? 0) * q, diamants: (it.price.diamants ?? 0) * q }} />
                    <div className="row">
                      {[1, 5, 10].map((n) => <button key={n} className={`btn small ${q === n ? 'on' : ''}`} onClick={() => setQty({ ...qty, [id]: n })}>×{n}</button>)}
                    </div>
                    <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'buyItem', item: id, qty: q })}>Acheter</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Frame>
  );
}

// ------------------------------------------------------------------ Capitaines
export function CaptainsPanel() {
  const p = useStore((s) => s.profile)!;
  const [sel, setSel] = useState(CAPTAINS[0].id);
  const c = CAPTAINS.find((x) => x.id === sel)!;
  const owned = p.captains.includes(c.id);
  const active = p.captainsActive[c.cat] === c.id;
  return (
    <Frame title="Capitaines" icon="profil" onClose={close} wide>
      <div className="captains">
        <div className="cap-list">
          {CAPTAIN_CATS.map((cat) => (
            <div key={cat.id}>
              <h4>{cat.name}</h4>
              <div className="cap-row">
                {CAPTAINS.filter((x) => x.cat === cat.id).map((x) => (
                  <button key={x.id} className={`cap-face ${sel === x.id ? 'sel' : ''} ${p.captains.includes(x.id) ? 'own' : ''} ${p.captainsActive[x.cat] === x.id ? 'active' : ''}`} onClick={() => setSel(x.id)} title={x.name}>
                    <span>{x.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="cap-ring">
          {CAPTAIN_CATS.map((cat, i) => {
            const id = p.captainsActive[cat.id];
            const x = CAPTAINS.find((y) => y.id === id);
            return <div key={cat.id} className={`ring-slot slot-${i}`} title={cat.name}>{x ? x.icon : '?'}</div>;
          })}
          <div className="ring-ship"><Icon name="voile" size={70} /></div>
        </div>
        <div className="cap-detail">
          <h3>{c.icon} {c.name}</h3>
          <p className="muted">{CAPTAIN_CATS.find((x) => x.id === c.cat)!.name}</p>
          <p>{c.desc}</p>
          {!owned ? (
            <><Price p={c.price} /> <button className="btn-gold big" onClick={() => send({ t: 'shop', a: 'recruit', captain: c.id })}>Recruter</button></>
          ) : active ? (
            <button className="btn" onClick={() => send({ t: 'shop', a: 'assign', captain: null, cat: c.cat })}>Retirer du poste</button>
          ) : (
            <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'assign', captain: c.id, cat: c.cat })}>Nommer à ce poste</button>
          )}
          <p className="muted small">Moyennant un certain coût, vos capitaines renforcent votre navire. Un seul capitaine par catégorie à la fois.</p>
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ Cartes bonus
export function BonusPanel() {
  const maps = useStore((s) => s.maps);
  const p = useStore((s) => s.profile)!;
  const lvl = levelFromXp(p.xp).level;
  const rank = { debutant: 'Débutant', confirme: 'Confirmé', elite: 'Élite' };
  return (
    <Frame title="Cartes bonus" icon="etoile" onClose={close} wide>
      <div className="bonus">
        <div className="bonus-list">
          {BONUS_ZONES.map((z) => {
            const b = z.bonus!;
            const info = maps.find((m) => m.id === z.id);
            const open = info?.open ?? false;
            return (
              <div key={z.id} className="bonus-card" style={{ borderColor: b.color }}>
                <h3 style={{ color: b.color }}>{z.name} <small>— {rank[b.rank]}</small></h3>
                <div className="bonus-body">
                  <div>
                    <p>{z.desc}</p>
                    <p className="ok small">Vous gagnez {fmt(b.per10k.elite)} points élite et {fmt(b.per10k.xp)} XP pour chaque tranche de 10 000 dégâts infligés à {b.bossName}.</p>
                    <p className="muted small">Niveau {b.minLevel}{b.maxLevel ? ` à ${b.maxLevel}` : ' et plus'} · {z.pvp === 'libre' ? 'PvP libre' : 'Sans PvP'} · Récompenses × {z.rewardMul.toFixed(1).replace('.', ',')}</p>
                  </div>
                  <div className="bonus-act">
                    <button className="btn-gold" disabled={!open || lvl < b.minLevel || (!!b.maxLevel && lvl > b.maxLevel)} onClick={() => send({ t: 'travel', zone: z.id })}>Faire voile</button>
                    <span className={open ? 'ok' : 'muted'}>{open ? 'Ouverte aujourd\'hui' : 'Ouverte le dimanche'}</span>
                    {open && info && <span className="small">{info.boss ? `${b.bossName} est là !` : `Navires coulés : ${info.kills ?? 0} / ${info.bossAt}`}</span>}
                    {info && <span className="small muted">{info.players} capitaine(s)</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bonus-side">
          <p>Chaque dimanche, l'Amirauté ouvre ces mers légendaires. Elles regorgent d'ennemis qui réapparaissent sans cesse : l'endroit idéal pour faire monter le niveau de votre navire.</p>
          <p>Mais prenez garde : ces eaux sont très dangereuses.</p>
        </div>
      </div>
    </Frame>
  );
}

// ------------------------------------------------------------------ Matelot de pont (onglet du port)
export function MatelotTab() {
  const p = useStore((s) => s.profile)!;
  return (
    <div className="matelot">
      <div className="mt-talk">
        <div className="mt-face">⚒</div>
        <p>« Apporte-moi la ferraille que tu as repêchée, et j'essaierai de la transformer en un pont solide. Mais la mer est impitoyable : le succès n'est jamais garanti. Si la forge échoue, la ferraille est perdue. »</p>
      </div>
      <p className="muted">Ferraille : <b>{fmt(p.ferraille)}</b> — elle se trouve dans les épaves des navires coulés.</p>
      <div className="forge-grid">
        {FORGE.map((f, i) => {
          const done = p.forge[i];
          const locked = i > 0 && !p.forge[i - 1];
          return (
            <button key={f.n} className={`forge-slot ${done ? 'done' : ''} ${locked ? 'locked' : ''}`} disabled={done || locked} onClick={() => send({ t: 'shop', a: 'forge', slot: i })}>
              <Icon name="marteau" size={26} />
              <b>Pont {f.n}</b>
              <small>{f.label}</small>
              {done ? <small className="ok">Forgé</small> : <small>{f.ferraille} ferraille · {fmt(f.or)} or · {Math.round(f.chance * 100)} %</small>}
            </button>
          );
        })}
      </div>
      <h3>Ponts décorés</h3>
      <div className="skins">
        {(Object.keys(SKINS) as SkinId[]).map((id) => {
          const sk = SKINS[id];
          const own = p.skins.includes(id);
          return (
            <div key={id} className={`skin-card skin-${id} ${p.skin === id ? 'on' : ''}`}>
              <span className="swatch" style={{ background: `linear-gradient(135deg, #${sk.deck.toString(16).padStart(6, '0')}, #${sk.trim.toString(16).padStart(6, '0')})` }} />
              <div><b>{sk.name}</b><small>{sk.desc}</small></div>
              {!own ? <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'buySkin', skin: id })}><Price p={sk.price} /></button>
                : p.skin === id ? <button className="btn" onClick={() => send({ t: 'shop', a: 'useSkin', skin: null })}>Retirer</button>
                : <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'useSkin', skin: id })}>Installer</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Navires élites (onglet du chantier)
export function EliteShipsTab() {
  const p = useStore((s) => s.profile)!;
  const preview = useStore((s) => s.preview);
  const next = ELITE_SHIPS.find((s) => s.elite! > p.elite);
  const sel = ELITE_SHIPS.find((s) => s.id === preview) ?? ELITE_SHIPS[0];
  useEffect(() => { if (!ELITE_SHIPS.some((s) => s.id === preview)) store.set({ preview: ELITE_SHIPS[0].id }); }, [preview]);
  const st = computeStats(sel);
  return (
    <div className="elite">
      <div className="elite-grid">
        {ELITE_SHIPS.map((s) => {
          const unlocked = p.elite >= s.elite!;
          return (
            <button key={s.id} className={`elite-card ${unlocked ? '' : 'locked'} ${sel.id === s.id ? 'sel' : ''}`} onClick={() => store.set({ preview: s.id })}>
              <span className="ec-swatch" style={{ background: `linear-gradient(160deg, #${s.look.sail.toString(16).padStart(6, '0')} 45%, #${s.look.hull.toString(16).padStart(6, '0')} 55%)` }}>{unlocked ? '' : '🔒'}</span>
              <b style={{ color: RARITY_COLOR[s.rarity] }}>{s.name}</b>
              <small>{fmt(s.elite!)} pts</small>
            </button>
          );
        })}
      </div>
      <div className="elite-detail">
        <h3>{sel.name}</h3>
        <p className="muted">{SHIP_CLASSES[sel.cls].name} · {sel.canons} canons</p>
        <p className="history">{sel.history}</p>
        <StatBar label="Résistance" value={st.hp} max={20000} />
        <StatBar label="Vitesse" value={st.speed} max={22} fmtValue={`${(st.speed * 0.7).toFixed(1)} nds`} />
        <StatBar label="Puissance de feu" value={st.broadside} max={2000} fmtValue={`${Math.round(st.broadside)}`} />
        {p.elite >= sel.elite! ? <button className="btn-gold big" onClick={() => send({ t: 'shop', a: 'eliteShip', ship: sel.id })}>Sélectionner</button> : <span className="war">Il faut {fmt(sel.elite!)} points élite</span>}
      </div>
      <div className="elite-foot">
        <span>Vos points élite actuels : <b>{fmt(p.elite)}</b></span>
        {next && <span>Prochain navire : <b>{fmt(next.elite!)}</b></span>}
        <span className="gold">10 % des dégâts infligés deviennent des points élite — ×5 avec les boulets de perle, ×12 avec les boulets de diamant.</span>
      </div>
    </div>
  );
}

