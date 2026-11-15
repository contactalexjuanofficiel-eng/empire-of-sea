// Éléments d'interface communs : icônes vectorielles originales, cadres, prix, jauges.
import { ROLES, shipRole, type ShipDef } from '../../../shared/ships';
import type { ReactNode } from 'react';
import { fmt } from '../../../shared/math';
import type { Game } from '../game/Game';

let gameRef: Game | null = null;
export const setGame = (g: Game) => { gameRef = g; };
export const game = () => gameRef!;
export const send: Game['net']['send'] = (m) => gameRef?.net.send(m);

const P = (d: string) => <path d={d} />;
const ICONS: Record<string, ReactNode> = {
  porte: <>{P('M10 4h8v16h-8')}{P('M4 12h10')}{P('M10 8l4 4-4 4')}</>,
  ancre: <>{P('M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z')}{P('M12 7v13')}{P('M7 11h10')}{P('M4 14c0 4 4 6 8 6s8-2 8-6')}{P('M4 14l-1.5 1.5M20 14l1.5 1.5')}</>,
  or: <><circle cx="12" cy="12" r="8" />{P('M12 7v10M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.7 2.5 1.7c0 2.5-5 1.4-5 4 0 1 1 1.7 2.5 1.7s2.5-.6 2.5-1.6')}</>,
  doublon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="5" />{P('M12 9v6M9 12h6')}</>,
  diamant: <>{P('M6 4h12l3 5-9 11L3 9z')}{P('M3 9h18M9 4l3 16M15 4l-3 16')}</>,
  perle: <><circle cx="12" cy="13" r="6" />{P('M10 11a2 2 0 0 1 2-2')}{P('M6 6l2 2M18 6l-2 2M12 3v3')}</>,
  bois: <>{P('M4 8h16v4H4zM6 12v8M18 12v8M4 8l2-4h12l2 4')}</>,
  toile: <>{P('M6 3v18M6 4c4 0 8 2 12 1v10c-4 1-8-1-12-1')}</>,
  fer: <>{P('M4 16l4-8h8l4 8zM8 8V5h8v3')}</>,
  canon: <>{P('M3 13l13-5 2 4-13 5z')}<circle cx="7" cy="17" r="3" />{P('M18 10l3-1')}</>,
  voile: <>{P('M12 2v20M5 5c3 1 11 1 14 0v11c-3 1-11 1-14 0z')}</>,
  boussole: <><circle cx="12" cy="12" r="9" />{P('M15 9l-2 4-4 2 2-4z')}</>,
  carte: <>{P('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14')}</>,
  coffre: <>{P('M3 10h18v9H3zM3 10c0-3 3-5 9-5s9 2 9 5M11 12h2v3h-2z')}</>,
  crane: <><circle cx="12" cy="10" r="6" /><circle cx="10" cy="10" r="1.3" /><circle cx="14" cy="10" r="1.3" />{P('M10 16v3h4v-3M5 20l14-4M5 16l14 4')}</>,
  drapeau: <>{P('M5 21V3M5 4h12l-2 4 2 4H5')}</>,
  reglages: <><circle cx="12" cy="12" r="3" />{P('M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2')}</>,
  trophee: <>{P('M8 3h8v6a4 4 0 0 1-8 0zM8 5H4c0 3 2 5 4 5M16 5h4c0 3-2 5-4 5M12 13v4M8 21h8M9 17h6')}</>,
  guilde: <>{P('M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z')}{P('M9 12l2 2 4-4')}</>,
  parchemin: <>{P('M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M9 9h7M9 13h7M9 17h4')}</>,
  sac: <>{P('M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0')}</>,
  profil: <><circle cx="12" cy="8" r="4" />{P('M4 21c0-4 4-7 8-7s8 3 8 7')}</>,
  marteau: <>{P('M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8')}</>,
  balance: <>{P('M12 3v18M5 21h14M4 8h16M7 8l-3 6h6zM17 8l-3 6h6z')}</>,
  feu: <>{P('M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-8z')}</>,
  seau: <>{P('M5 7h14l-2 13H7zM8 7a4 4 0 0 1 8 0')}</>,
  poudre: <>{P('M8 4h8v4l2 3v9H6v-9l2-3z')}{P('M12 11v5')}</>,
  aide: <><circle cx="12" cy="12" r="9" />{P('M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 17v.01')}</>,
  fermer: <>{P('M6 6l12 12M18 6L6 18')}</>,
  epee: <>{P('M4 20l4-4M6 14l4 4M8 16L19 5V3h-2L6 14')}</>,
  vent: <>{P('M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7')}</>,
  globe: <><circle cx="12" cy="12" r="9" />{P('M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18')}</>,
  etoile: <>{P('M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z')}</>,
};

export function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name] ?? ICONS.ancre}
    </svg>
  );
}

export function Price({ p }: { p: { or?: number; doublons?: number; perles?: number; diamants?: number } }) {
  const parts: ReactNode[] = [];
  if (p.or) parts.push(<span key="o" className="cur cur-or"><Icon name="or" size={14} />{fmt(p.or)}</span>);
  if (p.doublons) parts.push(<span key="d" className="cur cur-doublon"><Icon name="doublon" size={14} />{fmt(p.doublons)}</span>);
  if (p.perles) parts.push(<span key="p" className="cur cur-perle"><Icon name="perle" size={14} />{fmt(p.perles)}</span>);
  if (p.diamants) parts.push(<span key="m" className="cur c-diamant"><Icon name="diamant" size={14} />{fmt(p.diamants)}</span>);
  if (!parts.length) return <span className="cur muted">Offert</span>;
  return <span className="price">{parts}</span>;
}

export function Frame({ title, icon, onClose, children, wide, className = '' }: { title: string; icon?: string; onClose?: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={`frame ${wide ? 'frame-wide' : ''} ${className}`} role="dialog" aria-label={title}>
      <header className="frame-head">
        {icon && <Icon name={icon} size={22} />}
        <h2>{title}</h2>
        {onClose && <button className="icon-btn" onClick={onClose} aria-label="Fermer"><Icon name="fermer" /></button>}
      </header>
      <div className="frame-body">{children}</div>
    </div>
  );
}

export function StatBar({ label, value, max, fmtValue, best }: { label: string; value: number; max: number; fmtValue?: string; best?: number }) {
  return (
    <div className="statbar">
      <span className="sl">{label}</span>
      <span className="sb"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />{best !== undefined && <b style={{ left: `${Math.min(100, (best / max) * 100)}%` }} />}</span>
      <span className="sv">{fmtValue ?? fmt(value)}</span>
    </div>
  );
}

export const PORTRAITS = ['⚓', '⚔', '☸', '♛', '✠', '⚜', '☀', '✦'];
export const PORTRAIT_NAMES = ['Le Marin', 'Le Bretteur', 'Le Navigateur', 'Le Noble', 'Le Chevalier de Malte', 'Le Fleurdelisé', 'Le Roi-Soleil', 'L\'Étoile du Nord'];

/** Pastille de classe de combat (Galion, Frégate, Vaisseau de guerre). */
export function RoleBadge({ def }: { def: ShipDef }) {
  if (def.look.monster) return null;
  const r = ROLES[shipRole(def)];
  return <span className="role-badge" style={{ borderColor: r.color, color: r.color }} title={r.desc}>{r.name} · {r.short}</span>;
}
