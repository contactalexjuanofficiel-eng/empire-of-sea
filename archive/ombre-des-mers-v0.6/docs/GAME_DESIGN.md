# Conception du jeu

## Boucle de jeu
Naviguer → affronter des navires ennemis → gagner or, XP et points d'élite → améliorer et changer de navire → affronter plus fort. Coffres et missions du jour en complément.

## Statistiques du navire du joueur
- PV max = 100 + 40 × niveau de coque + bonus du navire
- Dégâts par boulet = 14 + 4 × niveau de canons
- Vitesse max = 140 + 16 × niveau de voiles + bonus du navire (px/s)
- Rechargement = max(0,8 ; 2,2 − 0,15 × niveau de rechargement) secondes, par bord (bâbord et tribord séparés)
- Nombre de canons par salve = 3 + ⌊niveau de canons / 4⌋ + bonus du navire
- Régénération : 0,6 PV/s si on n'a pas été touché depuis 6 s
- Coût d'une amélioration au niveau `lv` : round(40 × 1,55^lv), niveau max 10

## Navires (or + points d'élite requis)
| Navire | Or | Élite | PV | Vitesse | Canons |
|---|---|---|---|---|---|
| Lougre corsaire | 0 | 0 | +0 | +0 | +0 |
| Corvette | 600 | 100 | +60 | +10 | +1 |
| Frégate | 1 800 | 400 | +140 | 0 | +2 |
| Vaisseau de ligne | 5 000 | 1 200 | +300 | −10 | +4 |
| Vaisseau amiral | 12 000 | 3 000 | +550 | −20 | +7 |

## Points d'élite
25 % des dégâts infligés aux ennemis (roquette : 50 %). Servent uniquement à débloquer les navires et certaines récompenses.

## Ennemis
| Type | PV | Dégâts | Récompense (or / XP) | Apparition |
|---|---|---|---|---|
| Lougre | 60 | 7 | 14 / 20 | tous niveaux |
| Frégate | 150 | 11 | 38 / 50 | niveau ≥ 3 |
| Vaisseau de ligne | 320 | 16 | 100 / 130 | niveau ≥ 6 |
| Vaisseau amiral | 700 | 24 | 260 / 300 | niveau ≥ 9 |

Mise à l'échelle : PV × (1 + 0,06 × (niveau − 1)), dégâts × (1 + 0,04 × (niveau − 1)). Nombre d'ennemis simultanés : min(10, 3 + ⌊niveau / 1,5⌋).
IA : se rapprocher jusqu'à 400 m, puis se placer **de côté** pour tirer une bordée, éviter les îles.

## Munitions et objets
Voir `shared/data.js` (source de vérité des prix et effets). Munitions : boulet (∞), ardent (+60 % dégâts), chaînes (ralentit de 50 % pendant 2,5 s), mitraille (+2 boulets, dispersion large). Objets : roquette (200 + 30 × niveau de dégâts), réparation (+40 % PV), vitesse (+50 % 12 s), bouclier (−25 % dégâts reçus 12 s).

## Mort
Le navire coulé réapparaît au centre de la carte, plein de PV, et perd 30 % de son or.

## Économie — à surveiller
- Niveau d'XP : il faut `niveau × 100` XP pour passer au suivant.
- Les prix des munitions et objets sont des estimations, **non équilibrées** : à régler en jouant, puis avec des statistiques réelles quand il y aura des joueurs.
- Aucune monnaie premium pour l'instant (volontaire : éviter le « pay-to-win » avant d'avoir une communauté).

## Monstres marins
Un monstre apparaît dès le niveau 3, un à la fois (toutes les 50 à 90 s). Il fonce sur le joueur et frappe au corps à corps (15 dégâts × échelle, toutes les secondes). 450 PV × échelle. Récompense : 220 or, 180 XP, +40 points d'élite. Les chaînes le ralentissent aussi.

## Abordage
Un navire ennemi (pas un monstre) à 25 % de PV ou moins et à moins de ~110 de la coque peut être abordé (touche R, ou clic dessus) : butin ×2 à ×3 l'or normal, XP ×1,5, points d'élite = 50 % de son XP.

## Vent
Direction qui varie lentement. Vitesse × (1 + 0,22 × cos(angle entre le cap et le vent)) : +22 % vent dans le dos, −22 % vent de face. S'applique au joueur et aux navires ennemis.
