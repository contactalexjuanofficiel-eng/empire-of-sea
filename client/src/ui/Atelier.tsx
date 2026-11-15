// Atelier du port : fabrication des compétences actives (niveaux 1 à 5).
import { ACTIVE_SKILLS, SKILL_MAX_LEVEL, skillCooldownMul, skillCraftCost, skillPower } from '../../../shared/combat';
import { fmt } from '../../../shared/math';
import { levelFromXp } from '../../../shared/progression';
import { useStore } from '../store';
import { Icon, Price, send } from './common';

export function AtelierTab() {
  const p = useStore((s) => s.profile)!;
  const lvl = levelFromXp(p.xp).level;
  return (
    <div className="atelier">
      <p className="muted">Les maîtres artisans du port améliorent vos compétences : chaque niveau renforce l'effet de 15 % et réduit la recharge de 8 %. Il faut de l'or, de la ferraille (repêchée sur les épaves) et des matériaux.</p>
      <div className="at-res"><span><Icon name="fer" size={14} /> Ferraille <b className="num">{fmt(p.ferraille)}</b></span><span><Icon name="bois" size={14} /> Bois <b className="num">{fmt(p.mat.bois)}</b></span><span><Icon name="toile" size={14} /> Toile <b className="num">{fmt(p.mat.toile)}</b></span><span><Icon name="fer" size={14} /> Fer <b className="num">{fmt(p.mat.fer)}</b></span></div>
      <div className="at-list">
        {ACTIVE_SKILLS.map((sk) => {
          const lv = p.skillLv?.[sk.id] ?? 1;
          const max = lv >= SKILL_MAX_LEVEL;
          const c = skillCraftCost(lv);
          const can = !max && p.or >= c.or && p.ferraille >= c.ferraille && p.perles >= c.perles && p.mat.bois >= c.mat.bois && p.mat.toile >= c.mat.toile && p.mat.fer >= c.mat.fer;
          return (
            <div key={sk.id} className={`at-card ${lvl < sk.level ? 'locked' : ''}`}>
              <div className="at-ico"><Icon name={sk.icon} size={26} /></div>
              <div className="at-main">
                <h4>{sk.name} <span className="at-lv num">Niv. {lv}/{SKILL_MAX_LEVEL}</span></h4>
                <div className="at-pips">{Array.from({ length: SKILL_MAX_LEVEL }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}</div>
                <p className="small">{sk.desc}</p>
                <p className="small muted">Puissance actuelle × {skillPower(lv).toFixed(2).replace('.', ',')} · recharge {Math.round(sk.cooldown * skillCooldownMul(lv))} s · énergie {sk.energy}{lvl < sk.level ? ` · utilisable au niveau ${sk.level}` : ''}</p>
              </div>
              <div className="at-act">
                {max ? <span className="ok">Maîtrisée</span> : (
                  <>
                    <Price p={{ or: c.or, perles: c.perles }} />
                    <span className="small muted num">{c.ferraille} ferraille · {c.mat.bois} bois · {c.mat.toile} toile · {c.mat.fer} fer</span>
                    <button className="btn-gold" disabled={!can} onClick={() => send({ t: 'shop', a: 'craftSkill', skill: sk.id })}>Fabriquer niv. {lv + 1}</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
