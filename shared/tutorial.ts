// Tutoriel du débutant : six étapes guidées, validées par le serveur, chacune récompensée.
export type TutoKind = 'move' | 'attack' | 'kill' | 'loot' | 'skill' | 'repair';

export interface TutoStep { kind: TutoKind; title: string; text: string; reward: { or: number; xp: number; perles?: number } }

export const TUTORIAL: TutoStep[] = [
  { kind: 'move', title: 'Naviguer', text: 'Cliquez sur la mer : votre navire s\'y rend tout seul. Un point vert marque la destination.', reward: { or: 300, xp: 40 } },
  { kind: 'attack', title: 'Choisir une cible', text: 'Cliquez sur un navire pirate (nom en rouge, « PNJ ») : vos canons tirent automatiquement dès qu\'il est à portée.', reward: { or: 400, xp: 60 } },
  { kind: 'kill', title: 'Couler un ennemi', text: 'Restez sur votre cible jusqu\'à ce qu\'elle sombre.', reward: { or: 800, xp: 120 } },
  { kind: 'loot', title: 'Ramasser le butin', text: 'Le butin flotte là où l\'ennemi a coulé (halo doré sur l\'eau) : passez dessus pour le récupérer.', reward: { or: 300, xp: 40 } },
  { kind: 'skill', title: 'Lancer une compétence', text: 'Appuyez sur A (ou cliquez sur la première case de compétence en bas) : Bordée concentrée recharge vos canons et renforce vos tirs.', reward: { or: 400, xp: 60 } },
  { kind: 'repair', title: 'Réparer le navire', text: 'Ouvrez le Port (bouton en haut) puis « Réparer le navire », hors combat. Tout le reste s\'y trouve aussi : chantier, arsenal, équipement…', reward: { or: 1000, xp: 150, perles: 3 } },
];
