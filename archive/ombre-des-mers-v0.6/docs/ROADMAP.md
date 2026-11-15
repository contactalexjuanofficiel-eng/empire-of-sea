# Feuille de route

Chaque étape doit rester jouable. Cocher au fur et à mesure.

## Étape 1 — Valider ce qui existe
- [ ] `npm install && npm test && npm start` : le serveur démarre, les 8 tests passent.
- [ ] Écrire un petit client de test (script Node) qui se connecte en WebSocket, envoie `join`, `input`, `fire`, et affiche les instantanés.
- [ ] Vérifier la limitation de débit et la validation des messages.

## Étape 2 — Client en modules
- [ ] Mettre en place Vite (`npm create vite`), TypeScript optionnel mais conseillé.
- [ ] Découper `client/index.html` : `data` (import de `shared/data.js`), `input`, `render`, `ui` (chantier, missions), `game` (boucle).
- [ ] Garder le mode solo fonctionnel pendant toute la migration.

## Étape 3 — Brancher client et serveur
- [ ] Le client envoie `input` (cap et voiles) et `fire` ; il n'applique plus la physique lui-même en mode en ligne.
- [ ] Interpolation entre deux instantanés (délai d'affichage ~100 ms) pour fluidifier.
- [ ] Prédiction locale du joueur + réconciliation (si besoin).
- [ ] Affichage des autres joueurs (nom, navire, vie).

## Étape 4 — Comptes et sauvegarde serveur
- [ ] Connexion (e-mail ou compte social) et profil stockés côté serveur (Supabase est déjà disponible dans l'environnement d'Alex).
- [ ] L'or, les améliorations, les navires et les points d'élite vivent côté serveur uniquement.
- [ ] Achats validés côté serveur (le client demande, le serveur vérifie l'or et applique).

## Étape 5 — Contenu de gameplay
- [x] Monstres marins (client solo : Kraken, Léviathan…) — reste : boss de zone, versions serveur.
- [x] Abordage (client solo) — reste : version serveur.
- [x] Vent qui influence la vitesse (client solo) — reste : version serveur.
- [x] Sons synthétisés (client) — reste : vrais sons et musique.
- [ ] Secteurs de carte (comme des zones numérotées) avec difficulté croissante ; carte plus grande.
- [ ] Équipement : canons et mâts à acheter puis à installer (capacité limitée par navire).
- [ ] Missions de niveau (objectifs ciblés par type de navire) en plus des missions du jour.

## Étape 6 — Social et compétition
- [ ] Flottes/guildes et alliances, chat.
- [ ] Classements (expérience, élite, guerre, saison) calculés côté serveur.
- [ ] Combat entre joueurs (PvP) avec zones dédiées.

## Étape 7 — Habillage et mise en ligne
- [ ] Graphismes **originaux** (sprites de navires, îles, interface au style français d'époque). Ne pas réutiliser d'images d'autres jeux.
- [ ] Sons et musique libres de droits, ou composés par Alex.
- [ ] Hébergement du serveur (conteneur + domaine), HTTPS/WSS.
- [ ] Application mobile (Capacitor) si le jeu plaît sur navigateur.
- [ ] Mentions légales, politique de confidentialité, conditions d'utilisation, âge minimum.
- [ ] Choisir un **nom de jeu définitif** et vérifier qu'il est disponible (marque, domaine, stores).

## Idées en vrac
Vent (direction et force) qui influence la vitesse ; météo et brouillard ; commerce entre ports ; équipage ; figures historiques en capitaines ennemis ; campagnes à thème (Guerre d'indépendance américaine, Trafalgar, corsaires de Saint-Malo).

## v0.5 — Prototype 3D (client3d/)
- Fait : océan shader, navires procéduraux, caméra, canons, IA pirate, port, sauvegarde. Solo.
- À faire : voir `docs/PROMPT_CLAUDE_CODE.md`.

## v0.6 — Multijoueur et MMORPG de base
- Fait : WebSocket maison testé, client 3D en ligne, PvP (zone sûre au port), boutique serveur, comptes (scrypt),
  sauvegarde JSON, chat monde/guilde, guildes + alliances + guerres, 5 régions, événement boss toutes les 5 min.
- À faire : base SQL, rendu vérifié sur navigateur réel, interpolation plus fine, anti-triche avancé,
  abordage, monstres marins, vent, ports multiples, quêtes, classements, interface mobile, déploiement (HTTPS/wss).
