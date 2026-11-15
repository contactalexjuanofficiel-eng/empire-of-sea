# Ombre des Mers — contexte pour Claude Code

Jeu de combat naval 2D en vue de dessus, **français**, époque de la marine à voile (XVIIe–XIXe siècle).
Projet d'Alex (chanteur, développeur débutant). Réponds-lui **en français**, simplement, en expliquant les choix techniques.

## Vision
- Un jeu **original** : ne jamais copier les noms, graphismes ni textes de Shadow of Sea, Seafight, World of Sea Battle ou autres. On s'inspire des *principes* de gameplay (combat de côté, munitions, élite, missions), pas des assets.
- Identité française : navires historiques (Le Redoutable, La Belle Poule, L'Hermione, Le Soleil Royal…), îles aux noms français, textes en français.
- Plateformes visées : navigateur (PC + mobile) d'abord ; plus tard multijoueur en ligne.

## État actuel (v0.3)
| Partie | Fichier | État |
|---|---|---|
| Client jouable solo | `client/index.html` (fichier unique, canvas 2D, ~1200 lignes) | **Fonctionne** ; `tests/client-smoke.cjs` le fait tourner 90 s dans un faux navigateur |
| Données partagées | `shared/data.js` | Prêt, mais le client a encore ses propres copies |
| Simulation autoritaire | `server/sim.js` + `server/sim.test.js` | **8 tests verts** (`npm test`) |
| Serveur WebSocket | `server/index.js` | **Jamais lancé en réseau** — à valider en premier |
| Client ↔ serveur | — | **Pas branché** |

## Carte de `client/index.html`
Tout est dans une IIFE. Sections (repères `/* ---------- ... ---------- */`) :
- **navires, noms** : `SHIPS`, `AMMO`, `ITEMS`, `NAMES`, `ISL` → à remplacer par des imports de `shared/data.js`.
- **sauvegarde** : `save`, `persist()` (localStorage, facultatif et dans un try/catch), `ensureM()` (missions du jour), `stats()`.
- **monde** : îles générées avec un RNG à graine (`sr`), coffres d'île `chests`, coffres en mer `seaChests`.
- **combat** : `shoot`, `fireSide(side)`, `fireAuto`, `useItem`, `hurtPlayer`, `killEnemy`, `spawnEnemy`, `updEnemy`.
- **monstres et abordage** : `spawnMonster`, `updMonster` (tentacules au corps à corps), `canBoard`/`board`/`boardNearest` (touche R ou clic sur un navire très endommagé).
- **vent** : `wind`, `windF(angle)` (±22 % de vitesse) ; flèche dans la minicarte.
- **sons** : `audioInit`, `tone`, `sfx` (WebAudio synthétisé, touche M pour couper).
- **entrées** : clavier (`e.code` physique, donc W/A/S/D marche sur AZERTY), souris (`clickAt` : naviguer ou viser), tactile (joystick gauche), barre de munitions (`hbRect`/`hbHit`/`slot`).
- **chantier** : `renderShop()` (HTML DOM, textContent uniquement — jamais `innerHTML` avec des données joueur).
- **boucle** : `update(dt)` puis `draw()` (`drawSea`, `drawIsland`, `drawShip`, `drawHUD`, `drawBottom`).

## Règles de conception (importantes)
1. **Le serveur est l'autorité.** Or, dégâts, XP, positions, achats : décidés côté serveur. Le client n'envoie que des *intentions* (`input`, `fire`) et affiche. Sinon, des joueurs tricheront.
2. Toute entrée client est **bornée et validée** (voir `setInput`). Taille et fréquence des messages limitées.
3. Pas de secret ni de clé dans le client.
4. Le monde est **déterministe** par graine : même graine = mêmes îles (client et serveur doivent rester d'accord).
5. Textes affichés via `textContent` / `fillText`, jamais injectés en HTML brut.
6. Les nombres d'équilibrage vivent dans `shared/data.js` et `docs/GAME_DESIGN.md`.

## Commandes
```
npm install        # installe ws
npm test           # simulation serveur (node:test) + test de fumée du client
npm start          # serveur WebSocket sur ws://localhost:8080
npm run client     # sert client/ en HTTP (nécessaire dès qu'on passera aux modules ES)
```

## Par où commencer (ordre conseillé)
Voir `docs/ROADMAP.md`. Résumé : (1) lancer et valider le serveur, (2) migrer le client en modules ES avec Vite + imports de `shared/data.js`, (3) brancher le client sur le serveur (interpolation), (4) comptes + sauvegarde serveur, (5) monstres marins et abordage, (6) guildes et classements, (7) vrais graphismes originaux.

## Pièges connus
- Bogue déjà corrigé grâce au test de fumée : la mort du joueur vide `balls` en pleine boucle. Toujours protéger les boucles qui modifient des tableaux.
- Un `<script type="module">` ne marche pas en `file://` : utiliser `npm run client` ou Vite.
- Dans le prototype hébergé (artifact Claude), `localStorage` peut être absent : toujours dans un `try/catch`.
- `node --test server/` échoue sur Node 22 : utiliser `node --test` (déjà dans `npm test`).
