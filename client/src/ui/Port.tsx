// Le port : capitainerie, chantier naval, arsenal, améliorations, marché, réparations, départ en mer.
import { useEffect, useState } from 'react';
import { AMMO, AMMO_ORDER, CONSUMABLES, CONSUMABLE_ORDER, GOODS, GOOD_ORDER, MAX_SKILL, MAX_UPGRADE, MATERIAL_NAMES, SKILL_INFO, UPGRADE_INFO, upgradeCost, type SkillId, type UpgradeSlot } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import { levelFromXp } from '../../../shared/progression';
import type { MissionOffer } from '../../../shared/protocol';
import { computeStats, PLAYER_SHIPS, RARITY_COLOR, RARITY_LABEL, SHIP_BY_ID, SHIP_CLASSES } from '../../../shared/ships';
import { ZONE_BY_ID } from '../../../shared/zones';
import { store, useStore } from '../store';
import { Frame, game, Icon, Price, send, StatBar } from './common';

const TABS: [string, string, string][] = [
  ['capitainerie', 'parchemin', 'Capitainerie'],
  ['chantier', 'marteau', 'Chantier naval'],
  ['arsenal', 'canon', 'Arsenal'],
  ['ameliorations', 'etoile', 'Améliorations'],
  ['marche', 'balance', 'Marché'],
];

export function PortPanel() {
  const tab = useStore((s) => s.portTab);
  const port = useStore((s) => s.port);
  const zone = useStore((s) => s.zone);
  const p = useStore((s) => s.profile);
  const z = ZONE_BY_ID[zone];
  const portName = z?.ports.find((x) => x.id === port)?.name ?? 'Port';
  if (!p) return null;
  return (
    <div className="port-wrap">
      <Frame title={`Port de ${portName}`} icon="ancre" wide className="port">
        <div className="port-tabs">
          {TABS.map(([id, icon, label]) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => { store.set({ portTab: id }); game().audio.click(); }}><Icon name={icon} /> {label}</button>
          ))}
        </div>
        <div className="port-content">
          {tab === 'capitainerie' && <Capitainerie />}
          {tab === 'chantier' && <Chantier />}
          {tab === 'arsenal' && <Arsenal />}
          {tab === 'ameliorations' && <Ameliorations />}
          {tab === 'marche' && <Marche />}
        </div>
        <footer className="port-foot">
          <RepairButton />
          <button className="btn" onClick={() => store.set({ panel: 'carte' })}><Icon name="globe" /> Carte du monde</button>
          <button className="btn-gold big" onClick={() => game().undock()}><Icon name="voile" /> Prendre la mer</button>
        </footer>
      </Frame>
    </div>
  );
}

function RepairButton() {
  const p = useStore((s) => s.profile)!;
  const s = p.ships.find((x) => x.uid === p.active);
  if (!s) return null;
  return <button className="btn" onClick={() => send({ t: 'shop', a: 'repair' })} title="Les charpentiers de l'arsenal remettent votre navire à neuf"><Icon name="marteau" /> Réparer le navire</button>;
}

function rewardText(r: MissionOffer['reward']) {
  const parts = [`${fmt(r.or)} or`, `${fmt(r.xp)} XP`, `${r.rep} réputation`];
  if (r.doublons) parts.push(`${r.doublons} doublons`);
  if (r.mat) for (const [k, v] of Object.entries(r.mat)) parts.push(`${v} ${MATERIAL_NAMES[k as keyof typeof MATERIAL_NAMES].toLowerCase()}`);
  return parts.join(' · ');
}

function Capitainerie() {
  const data = useStore((s) => s.portData);
  const p = useStore((s) => s.profile)!;
  const zone = ZONE_BY_ID[useStore((s) => s.zone)];
  return (
    <div className="cap">
      <section>
        <h3>Missions de l'Amirauté</h3>
        <p className="muted">{zone.desc}</p>
        {!data?.offers.length && <p className="muted">Aucune mission pour l'instant.</p>}
        <div className="mission-list">
          {data?.offers.map((o) => {
            const active = p.missions.some((m) => m.id === o.id);
            return (
              <div key={o.id} className={`mission type-${o.type} ${active ? 'active' : ''}`}>
                <div className="m-head"><b>{o.title}</b><span className="m-type">{({ chasse: 'Chasse', livraison: 'Commerce', exploration: 'Exploration', tresor: 'Trésor', boss: 'Événement' } as const)[o.type]}</span></div>
                <p>{o.desc}</p>
                <div className="m-foot"><span className="m-reward"><Icon name="coffre" size={14} /> {rewardText(o.reward)}</span>
                  {active ? <span className="ok">En cours</span> : <button className="btn-gold" onClick={() => send({ t: 'mission', a: 'accept', id: o.id })}>Accepter</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h3>Missions en cours ({p.missions.length}/3)</h3>
        {p.missions.map((m) => (
          <div key={m.id} className="mission active">
            <div className="m-head"><b>{m.title}</b><span className="m-type">{m.zone === zone.id ? zone.name : ZONE_BY_ID[m.zone]?.name}</span></div>
            <div className="ms-prog"><i style={{ width: `${(m.progress / m.goal) * 100}%` }} /><span>{fmt(m.progress)} / {fmt(m.goal)}</span></div>
            <button className="btn small" onClick={() => send({ t: 'mission', a: 'abandon', id: m.id })}>Abandonner</button>
          </div>
        ))}
        {!p.missions.length && <p className="muted">Acceptez jusqu'à trois missions à la fois.</p>}
      </section>
    </div>
  );
}

function Chantier() {
  const p = useStore((s) => s.profile)!;
  const preview = useStore((s) => s.preview);
  const lvl = levelFromXp(p.xp).level;
  const activeDef = p.ships.find((s) => s.uid === p.active)?.def ?? 'bayonnaise';
  const sel = SHIP_BY_ID[preview] && !SHIP_BY_ID[preview].npcOnly ? SHIP_BY_ID[preview] : SHIP_BY_ID[activeDef];
  useEffect(() => { if (!SHIP_BY_ID[preview] || SHIP_BY_ID[preview].npcOnly) store.set({ preview: activeDef }); }, [preview, activeDef]);
  const owned = p.ships.find((s) => s.def === sel.id);
  const st = computeStats(sel, owned?.up, p.skills);
  const cur = computeStats(SHIP_BY_ID[activeDef], p.ships.find((s) => s.uid === p.active)?.up, p.skills);
  const cls = SHIP_CLASSES[sel.cls];
  const afford = (sel.price.or ?? 0) <= p.or && (sel.price.doublons ?? 0) <= p.doublons && (sel.price.perles ?? 0) <= p.perles;
  const byClass = Object.values(SHIP_CLASSES).map((c) => ({ c, ships: PLAYER_SHIPS.filter((s) => s.cls === c.id) }));
  return (
    <div className="shipyard">
      <div className="ship-catalog">
        {byClass.map(({ c, ships }) => (
          <div key={c.id} className="cls-group">
            <div className="cls-head"><span className="tier">{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][c.tier - 1]}</span> {c.name}</div>
            {ships.map((s) => {
              const own = p.ships.some((x) => x.def === s.id);
              const locked = lvl < s.level;
              return (
                <button key={s.id} className={`ship-row ${sel.id === s.id ? 'on' : ''} ${locked ? 'locked' : ''}`} onClick={() => store.set({ preview: s.id })}>
                  <span className="sr-name" style={{ color: RARITY_COLOR[s.rarity] }}>{s.name}</span>
                  <span className="sr-info">{own ? (s.id === activeDef ? '★ Actif' : 'Possédé') : locked ? `Niv. ${s.level}` : <Price p={s.price} />}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="ship-detail">
        <div className="sd-head">
          <h3>{sel.name}</h3>
          <span className="rarity" style={{ borderColor: RARITY_COLOR[sel.rarity], color: RARITY_COLOR[sel.rarity] }}>{RARITY_LABEL[sel.rarity]}</span>
        </div>
        <div className="sd-class">{cls.name} · rang {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][cls.tier - 1]} · {sel.canons} canons · niveau requis {sel.level}</div>
        <p className="history">{sel.history}</p>
        <p className="muted small">{cls.desc}</p>
        <StatBar label="Résistance" value={st.hp} max={16000} best={cur.hp} />
        <StatBar label="Vitesse" value={st.speed} max={22} fmtValue={`${(st.speed * 0.7).toFixed(1)} nds`} best={cur.speed} />
        <StatBar label="Maniabilité" value={st.turn} max={0.75} fmtValue={`${Math.round(st.turn * 100)}`} best={cur.turn} />
        <StatBar label="Puissance de feu" value={st.broadside} max={1500} fmtValue={`${Math.round(st.broadside)} / bordée`} best={cur.broadside} />
        <StatBar label="Portée" value={st.range} max={450} fmtValue={`${Math.round(st.range)} m`} best={cur.range} />
        <StatBar label="Rechargement" value={10 - st.reload} max={10} fmtValue={`${st.reload.toFixed(1)} s`} best={10 - cur.reload} />
        <StatBar label="Blindage" value={st.armor * 100} max={40} fmtValue={`${Math.round(st.armor * 100)} %`} best={cur.armor * 100} />
        <StatBar label="Cale" value={st.cargo} max={220} fmtValue={`${st.cargo} tx`} best={cur.cargo} />
        <p className="muted small">Le repère clair indique votre navire actif. L'aperçu 3D est amarré au quai.</p>
        <div className="sd-actions">
          {owned ? (
            owned.uid === p.active ? <span className="ok">Navire actif</span> : <button className="btn-gold big" onClick={() => send({ t: 'shop', a: 'selectShip', uid: owned.uid })}>Prendre le commandement</button>
          ) : (
            <>
              <Price p={sel.price} />
              <button className="btn-gold big" disabled={lvl < sel.level || !afford} onClick={() => send({ t: 'shop', a: 'buyShip', ship: sel.id })}>
                {lvl < sel.level ? `Niveau ${sel.level} requis` : afford ? 'Commander ce navire' : 'Fonds insuffisants'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Arsenal() {
  const p = useStore((s) => s.profile)!;
  return (
    <div className="arsenal">
      <section>
        <h3>Munitions</h3>
        {AMMO_ORDER.map((id) => {
          const a = AMMO[id];
          return (
            <div key={id} className="shop-row">
              <span className={`ball-ico ammo-${id}`} />
              <div className="sr-txt"><b>{a.name}</b><small>{a.desc}</small><small className="muted">Coque ×{a.hull} · Voilure ×{a.sail} · Portée ×{a.range}{a.fire ? ` · Incendie ${Math.round(a.fire * 100)} %` : ''}</small></div>
              <span className="have">{id === 'rond' ? '∞' : p.ammo[id]}</span>
              {a.price ? <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'buyAmmo', ammo: id })}>+{a.pack} <Price p={a.price} /></button> : <span className="muted">Illimité</span>}
            </div>
          );
        })}
      </section>
      <section>
        <h3>Équipements</h3>
        {CONSUMABLE_ORDER.map((id) => {
          const c = CONSUMABLES[id];
          return (
            <div key={id} className="shop-row">
              <Icon name={id === 'kit' ? 'marteau' : id === 'seau' ? 'seau' : 'poudre'} size={26} />
              <div className="sr-txt"><b>{c.name} <kbd>{c.key}</kbd></b><small>{c.desc}</small></div>
              <span className="have">{p.items[id]}</span>
              <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'buyItem', item: id, qty: 1 })}>+1 <Price p={c.price} /></button>
              <button className="btn" onClick={() => send({ t: 'shop', a: 'buyItem', item: id, qty: 5 })}>+5</button>
            </div>
          );
        })}
        <div className="shop-row">
          <Icon name="perle" size={26} />
          <div className="sr-txt"><b>Bureau de change</b><small>Échangez 10 doublons contre 1 perle.</small></div>
          <button className="btn" onClick={() => send({ t: 'shop', a: 'exchange', what: 'doublons' })}>Échanger</button>
        </div>
      </section>
    </div>
  );
}

function Ameliorations() {
  const p = useStore((s) => s.profile)!;
  const ship = p.ships.find((s) => s.uid === p.active)!;
  const def = SHIP_BY_ID[ship.def];
  const tier = SHIP_CLASSES[def.cls].tier;
  const lvl = levelFromXp(p.xp).level;
  const used = p.skills.artillerie + p.skills.navigation + p.skills.charpenterie + p.skills.commerce;
  const points = Math.max(0, lvl - 1 - used);
  return (
    <div className="upgrades">
      <section>
        <h3>Améliorations de {def.name}</h3>
        {(Object.keys(UPGRADE_INFO) as UpgradeSlot[]).map((slot) => {
          const info = UPGRADE_INFO[slot];
          const cur = ship.up[slot];
          const cost = upgradeCost(tier, cur);
          return (
            <div key={slot} className="shop-row">
              <Icon name={slot === 'coque' ? 'bois' : slot === 'voiles' ? 'voile' : slot === 'canons' ? 'canon' : 'fer'} size={26} />
              <div className="sr-txt"><b>{info.name}</b><small>{info.effect}</small>
                <span className="pips">{Array.from({ length: MAX_UPGRADE }, (_, i) => <i key={i} className={i < cur ? 'on' : ''} />)}</span>
              </div>
              {cur >= MAX_UPGRADE ? <span className="ok">Maximum</span> : (
                <button className="btn-gold" onClick={() => send({ t: 'shop', a: 'upgrade', slot })}>
                  Niv. {cur + 1} · <Price p={{ or: cost.or }} /> + {cost.mat} {MATERIAL_NAMES[info.mat].toLowerCase()}
                </button>
              )}
            </div>
          );
        })}
      </section>
      <section>
        <h3>Compétences du capitaine <span className="pts">{points} point{points > 1 ? 's' : ''} disponible{points > 1 ? 's' : ''}</span></h3>
        {(Object.keys(SKILL_INFO) as SkillId[]).map((k) => (
          <div key={k} className="shop-row">
            <Icon name={k === 'artillerie' ? 'canon' : k === 'navigation' ? 'boussole' : k === 'charpenterie' ? 'marteau' : 'balance'} size={26} />
            <div className="sr-txt"><b>{SKILL_INFO[k].name}</b><small>{SKILL_INFO[k].effect}</small>
              <span className="pips">{Array.from({ length: MAX_SKILL }, (_, i) => <i key={i} className={i < p.skills[k] ? 'on' : ''} />)}</span>
            </div>
            <button className="btn-gold" disabled={!points || p.skills[k] >= MAX_SKILL} onClick={() => send({ t: 'shop', a: 'skill', skill: k })}>+1</button>
          </div>
        ))}
        <p className="muted small">Un point par niveau gagné. Les ressources de construction (bois, toile, fer) s'obtiennent en repêchant le butin des navires coulés, dans les trésors et en mission.</p>
      </section>
    </div>
  );
}

function Marche() {
  const p = useStore((s) => s.profile)!;
  const data = useStore((s) => s.portData);
  const [qty, setQty] = useState(5);
  const cap = computeStats(SHIP_BY_ID[p.ships.find((s) => s.uid === p.active)!.def]).cargo;
  const used = Object.values(p.cargo).reduce((a, b) => a + (b || 0), 0);
  return (
    <div className="market">
      <div className="mk-head">
        <span>Cale : <b>{used}</b> / {cap} tonneaux</span>
        <span>Quantité : {[1, 5, 10, 25].map((q) => <button key={q} className={`btn small ${qty === q ? 'on' : ''}`} onClick={() => setQty(q)}>{q}</button>)}</span>
      </div>
      <table className="mk">
        <thead><tr><th>Marchandise</th><th>À bord</th><th>Achat</th><th>Vente</th><th /></tr></thead>
        <tbody>
          {GOOD_ORDER.map((g) => {
            const pr = data?.prices[g];
            if (!pr) return null;
            const base = GOODS[g].base;
            return (
              <tr key={g}>
                <td>{GOODS[g].name}</td>
                <td>{p.cargo[g] ?? 0}</td>
                <td className={pr.buy < base * 0.8 ? 'cheap' : ''}>{fmt(pr.buy)}</td>
                <td className={pr.sell > base * 1.3 ? 'dear' : ''}>{fmt(pr.sell)}</td>
                <td className="mk-act">
                  <button className="btn small" onClick={() => send({ t: 'shop', a: 'trade', good: g, qty, buy: true })}>Acheter</button>
                  <button className="btn small" disabled={!(p.cargo[g] ?? 0)} onClick={() => send({ t: 'shop', a: 'trade', good: g, qty: Math.min(qty, p.cargo[g] ?? 0), buy: false })}>Vendre</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">Achetez bon marché (en vert) là où une marchandise est produite, revendez cher (en or) là où elle est demandée. La cargaison est perdue si votre navire coule.</p>
    </div>
  );
}
