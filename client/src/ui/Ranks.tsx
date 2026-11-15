// Fenêtre des rangs : rang général (grades de la Marine française), rang de bataille, rang de pêche.
import { useState } from 'react';
import { AMMO, CONSUMABLES } from '../../../shared/items';
import { fmt } from '../../../shared/math';
import {
  BATTLE_STEPS, battlePoints, battleReward, battleThreshold, FISH_STEPS, fishReward, fishThreshold, GRADES, RANK_FORMULA, rankPoints, rewardText, stepOf,
} from '../../../shared/ranks';
import { store, useStore } from '../store';
import { Frame, send } from './common';

const close = () => store.set((s) => ({ panel: s.docked ? 'port' : null }));
const METAL: Record<string, [string, string]> = { or: ['#fff1b0', '#c9961e'], argent: ['#ffffff', '#8a96a6'], bronze: ['#f0b878', '#8a4a1a'], fer: ['#b8b8b8', '#4a4a4a'] };

/** Fleur de lys originale, teintée selon le métal du grade. */
export function Lys({ metal, size = 80 }: { metal: keyof typeof METAL; size?: number }) {
  const [a, b] = METAL[metal];
  const id = `g-${metal}`;
  return (
    <svg width={size} height={size * 1.2} viewBox="-50 -60 100 120" className="lys">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
      <g fill={`url(#${id})`} stroke="#00000066" strokeWidth="1.5">
        <path d="M0 -58 C11 -42 15 -22 7 -2 L0 9 L-7 -2 C-15 -22 -11 -42 0 -58 Z" />
        <path d="M7 5 C14 -14 30 -32 45 -27 C57 -22 55 -5 43 -3 C49 -12 41 -19 32 -13 C23 -7 17 4 11 13 Z" />
        <path d="M-7 5 C-14 -14 -30 -32 -45 -27 C-57 -22 -55 -5 -43 -3 C-49 -12 -41 -19 -32 -13 C-23 -7 -17 4 -11 13 Z" />
        <rect x="-26" y="9" width="52" height="9" rx="3" />
        <path d="M-6 18 L6 18 L0 46 Z" />
        <path d="M5 18 C14 22 22 28 24 38 C15 33 9 28 3 24 Z" />
        <path d="M-5 18 C-14 22 -22 28 -24 38 C-15 33 -9 28 -3 24 Z" />
      </g>
    </svg>
  );
}

/** Écu étoilé du rang de bataille (une étoile tous les 8 rangs, couleur selon le palier). */
export function BattleShield({ step, size = 80 }: { step: number; size?: number }) {
  const metal = step >= 30 ? 'or' : step >= 20 ? 'argent' : step >= 10 ? 'bronze' : 'fer';
  const [a, b] = METAL[metal];
  const stars = Math.max(1, Math.min(5, Math.ceil(step / 8)));
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className="shield">
      <defs><linearGradient id={`s-${metal}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
      <path d="M-30 -40 H30 V5 C30 25 15 35 0 42 C-15 35 -30 25 -30 5 Z" fill={`url(#s-${metal})`} stroke="#0008" strokeWidth="2" />
      <text x="0" y="6" textAnchor="middle" fontSize="26" fontFamily="Cinzel, serif" fill="#1b1206">{step}</text>
      {Array.from({ length: stars }, (_, i) => {
        const x = (i - (stars - 1) / 2) * 16;
        return <path key={i} transform={`translate(${x} 38) scale(0.5)`} d="M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4 Z" fill={a} stroke="#000a" strokeWidth="2" />;
      })}
    </svg>
  );
}

const names = { ammo: (id: string) => AMMO[id as keyof typeof AMMO]?.name.toLowerCase() ?? id, item: (id: string) => CONSUMABLES[id as keyof typeof CONSUMABLES]?.name.toLowerCase() ?? id };

export function RanksPanel() {
  const p = useStore((s) => s.profile)!;
  const g = useStore((s) => s.grade);
  const [tab, setTab] = useState<'rang' | 'bataille' | 'peche'>('rang');
  const gi = g?.grade ?? GRADES.length - 1;
  const bp = battlePoints(p.shootXp);
  const bStep = stepOf(bp, battleThreshold, BATTLE_STEPS);
  const fStep = stepOf(p.fishXp, fishThreshold, FISH_STEPS);
  return (
    <Frame title="Rangs" icon="trophee" onClose={close} wide>
      <div className="eq-tabs">
        <button className={`btn ${tab === 'rang' ? 'on' : ''}`} onClick={() => setTab('rang')}>Rang</button>
        <button className={`btn ${tab === 'bataille' ? 'on' : ''}`} onClick={() => setTab('bataille')}>Rang de bataille</button>
        <button className={`btn ${tab === 'peche' ? 'on' : ''}`} onClick={() => setTab('peche')}>Rang de pêche</button>
      </div>
      {tab === 'rang' && (
        <div className="ranks">
          <div className="rk-main">
            <div className="rk-trio">
              <div><h4>Rang inférieur</h4>{gi < GRADES.length - 1 ? <Lys metal={GRADES[gi + 1].metal} size={60} /> : <span className="muted">—</span>}</div>
              <div className="cur"><h4>Rang actuel</h4><Lys metal={GRADES[gi].metal} size={96} /></div>
              <div><h4>Rang supérieur</h4>{gi > 0 ? <Lys metal={GRADES[gi - 1].metal} size={60} /> : <span className="muted">—</span>}</div>
            </div>
            <p>Grade actuel : <b>{GRADES[gi].name}</b>{g ? ` (${g.position === 1 ? '1er' : `${g.position}e`} au classement)` : ''}</p>
            <p>Points du rang actuel : <b>{fmt(g?.points ?? rankPoints(p))}</b></p>
            <p>Points du rang supérieur : <b>{g?.next != null ? fmt(g.next) : '—'}</b></p>
            <p>Points du rang inférieur : <b>{g?.prev != null ? fmt(g.prev) : '—'}</b></p>
            <p className="formula">Calcul du rang : {RANK_FORMULA}</p>
          </div>
          <div className="rk-side">
            <p className="small">Votre rang dépend de votre expérience, de vos points élite, des joueurs coulés, des trophées de boss et de votre niveau. Les grades sont limités : il faut les mériter face aux autres capitaines.</p>
            <h4>Grades disponibles</h4>
            {GRADES.map((x, i) => (
              <div key={x.name} className={`kv ${i === gi ? 'me' : ''}`}><span><Lys metal={x.metal} size={14} /> {x.name}</span><b>{x.places ? `${g?.counts?.[i] ?? 0} / ${x.places}` : `${g?.counts?.[i] ?? 0}`}</b></div>
            ))}
          </div>
        </div>
      )}
      {tab !== 'rang' && (() => {
        const bat = tab === 'bataille';
        const step = bat ? bStep : fStep;
        const pts = bat ? bp : p.fishXp;
        const max = bat ? BATTLE_STEPS : FISH_STEPS;
        const thr = bat ? battleThreshold : fishThreshold;
        const claimed = bat ? p.battleClaimed : p.fishClaimed;
        const toClaim = step - claimed;
        const nextReward = bat ? battleReward(Math.min(max, claimed + 1)) : fishReward(Math.min(max, claimed + 1));
        return (
          <div className="ranks">
            <div className="rk-main">
              <div className="rk-trio">
                <div><h4>Rang inférieur</h4>{step > 1 ? <BattleShield step={step - 1} size={64} /> : <span className="muted">—</span>}</div>
                <div className="cur"><h4>Rang actuel</h4>{step > 0 ? <BattleShield step={step} size={100} /> : <span className="muted">Aucun rang</span>}</div>
                <div><h4>Rang supérieur</h4>{step < max ? <BattleShield step={step + 1} size={64} /> : <span className="muted">—</span>}</div>
              </div>
              <p>Points actuels : <b>{fmt(pts)}</b> · Rang : <b>{step} / {max}</b>{step < max ? ` · prochain rang à ${fmt(thr(step + 1))}` : ''}</p>
              <p className="muted small">{bat ? 'Points de bataille : dégâts infligés aux ennemis (×5 contre les joueurs) et navires de joueurs coulés. Tous les 4 rangs : +1 % de dégâts.' : 'Points de pêche : chaque prise en rapporte. Plus votre rang est haut, plus vous pêchez vite et gros.'}</p>
              <div className="claim">
                <BattleShield step={Math.max(1, Math.min(max, claimed + 1))} size={48} />
                <button className="btn-gold" disabled={toClaim <= 0} onClick={() => send({ t: 'shop', a: 'claimRank', kind: bat ? 'bataille' : 'peche' })}>
                  {toClaim > 0 ? `Réclamer ${toClaim} récompense${toClaim > 1 ? 's' : ''}` : 'Rien à réclamer'}
                </button>
                <span className="small">Rang {Math.min(max, claimed + 1)} : {rewardText(nextReward, names)}</span>
              </div>
            </div>
            <div className="rk-side">
              <h4>Points requis</h4>
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <div key={n} className={`kv ${n === step ? 'me' : n <= step ? 'ok' : ''}`}><span>Rang {n}</span><b>{fmt(thr(n))}</b></div>
              ))}
            </div>
          </div>
        );
      })()}
    </Frame>
  );
}
