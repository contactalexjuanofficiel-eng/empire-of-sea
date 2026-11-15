import { useState } from 'react';
import { computeStats, RARITY_COLOR, RARITY_LABEL, SHIP_BY_ID, SHIP_CLASSES, STARTER_SHIPS } from '../../../shared/ships';
import { store, useStore } from '../store';
import { game, Icon, PORTRAIT_NAMES, PORTRAITS, StatBar } from './common';

const FLAGS = [
  { id: 'royal' as const, name: 'Pavillon royal', desc: 'Blanc semé de fleurs de lys — la Marine du Roi.' },
  { id: 'tricolore' as const, name: 'Pavillon tricolore', desc: 'Bleu, blanc, rouge — la Marine de la République.' },
  { id: 'imperial' as const, name: 'Pavillon impérial', desc: 'Les trois couleurs frappées de l\'aigle — la Marine impériale.' },
];

export function Create() {
  const name = useStore((s) => s.name);
  const preview = useStore((s) => s.preview);
  const [portrait, setPortrait] = useState(0);
  const [flag, setFlag] = useState<'royal' | 'tricolore' | 'imperial'>('royal');
  const [step, setStep] = useState(0);
  const ship = SHIP_BY_ID[STARTER_SHIPS.includes(preview) ? preview : 'bayonnaise'];
  const st = computeStats(ship);

  return (
    <div className="screen-create">
      <div className="create-panel">
        <h2>{step === 0 ? 'Votre capitaine' : 'Choisissez votre premier navire'}</h2>
        {step === 0 && (
          <>
            <p className="lead">Capitaine <b>{name}</b>, l'Amirauté vous confie votre première commission. Choisissez vos armes et vos couleurs.</p>
            <h3>Blason</h3>
            <p className="muted small">Votre emblème : il s'affiche à côté de votre nom (profil, classements).</p>
            <div className="portraits">
              {PORTRAITS.map((p, i) => (
                <button key={i} className={`portrait ${portrait === i ? 'on' : ''}`} onClick={() => setPortrait(i)} title={PORTRAIT_NAMES[i]}>
                  <span>{p}</span>
                </button>
              ))}
            </div>
            <p className="muted center">{PORTRAIT_NAMES[portrait]}</p>
            <h3>Pavillon</h3>
            <p className="muted small">Le drapeau qui flotte en haut du mât de tous vos navires : les autres capitaines le voient en mer.</p>
            <div className="flags">
              {FLAGS.map((f) => (
                <button key={f.id} className={`flagopt ${flag === f.id ? 'on' : ''}`} onClick={() => setFlag(f.id)}>
                  <span className={`flagswatch flag-${f.id}`} />
                  <b>{f.name}</b>
                  <small>{f.desc}</small>
                </button>
              ))}
            </div>
            <button className="btn-gold big" onClick={() => setStep(1)}>Continuer</button>
          </>
        )}
        {step === 1 && (
          <>
            <p className="muted small">Votre premier navire, offert par l'Amirauté. Vous en commanderez d'autres plus tard (plus gros, plus puissants) au chantier naval.</p>
            <div className="starter-list">
              {STARTER_SHIPS.map((id) => {
                const s = SHIP_BY_ID[id];
                return (
                  <button key={id} className={`starter ${ship.id === id ? 'on' : ''}`} onClick={() => store.set({ preview: id })}>
                    <b>{s.name}</b>
                    <small style={{ color: RARITY_COLOR[s.rarity] }}>{SHIP_CLASSES[s.cls].name} · {RARITY_LABEL[s.rarity]}</small>
                  </button>
                );
              })}
            </div>
            <div className="ship-sheet">
              <p className="history">{ship.history}</p>
              <StatBar label="Résistance" value={st.hp} max={1300} />
              <StatBar label="Vitesse" value={st.speed} max={22} fmtValue={`${(st.speed * 0.7).toFixed(1)} nœuds`} />
              <StatBar label="Maniabilité" value={st.turn} max={0.75} fmtValue={`${Math.round(st.turn * 100)}`} />
              <StatBar label="Bordée" value={st.broadside} max={180} fmtValue={`${Math.round(st.broadside)} dégâts`} />
              <StatBar label="Canons" value={ship.canons} max={24} fmtValue={`${ship.canons}`} />
              <StatBar label="Cale" value={st.cargo} max={30} fmtValue={`${st.cargo} tx`} />
            </div>
            <div className="row">
              <button className="btn" onClick={() => setStep(0)}>Retour</button>
              <button className="btn-gold big" onClick={() => game().sendCreate(portrait, flag, ship.id)}>
                <Icon name="ancre" /> Appareiller avec {ship.name}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
