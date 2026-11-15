// Tutoriel du débutant : six étapes guidées, validées par le serveur, chacune récompensée.
export type TutoKind = 'undock' | 'move' | 'attack' | 'kill' | 'skill' | 'dock';

export interface TutoStep { kind: TutoKind; title: string; text: string; reward: { or: number; xp: number; perles?: number } }

export const TUTORIAL: TutoStep[] = [
  { kind: 'undock', title: 'Prendre la mer', text: 'Au port, cliquez sur « Prendre la mer » (en bas à droite de la fenêtre du port).', reward: { or: 300, xp: 40 } },
  { kind: 'move', title: 'Naviguer', text: 'Cliquez sur la mer : votre navire s\'y rend tout seul. Un cercle vert marque la destination.', reward: { or: 300, xp: 40 } },
  { kind: 'attack', title: 'Choisir une cible', text: 'Cliquez sur un navire pirate (nom en rouge, « PNJ ») : vos canons tirent automatiquement dès qu\'il est à portée.', reward: { or: 400, xp: 60 } },
  { kind: 'kill', title: 'Couler un ennemi', text: 'Restez sur votre cible jusqu\'à ce qu\'elle sombre. Repêchez le butin qui flotte ensuite.', reward: { or: 800, xp: 120 } },
  { kind: 'skill', title: 'Lancer une compétence', text: 'Appuyez sur A (ou cliquez sur la première case de compétence en bas) : Bordée concentrée recharge vos canons et renforce vos tirs.', reward: { or: 400, xp: 60 } },
  { kind: 'dock', title: 'Rentrer au port', text: 'Cliquez sur l\'ancre (sous la mini-carte) pour rejoindre le port, puis « Accoster » pour réparer et vous équiper.', reward: { or: 1000, xp: 150, perles: 3 } },
];
