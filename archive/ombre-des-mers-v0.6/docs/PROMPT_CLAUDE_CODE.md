# Prompt pour Claude Code — Empire des Mers (MMORPG naval 3D français)

> À coller dans Claude Code, à la racine du projet (là où se trouve `CLAUDE.md`).

---

Tu reprends un projet existant : un jeu de combat naval **français**, original, inspiré du genre (Shadow of Sea, Battle of Sea, Seafight…) mais **jamais copié**. Lis d'abord `CLAUDE.md`, `docs/GAME_DESIGN.md` et `docs/ROADMAP.md`.

## État actuel (v0.6)
- `client3d/index.html` : client 3D (Three.js r128 via CDN, un seul fichier) : solo ET en ligne (`?ws=`), connexion/compte, chat, guildes, régions, boss.
- `server/` : simulation autoritaire (`sim.js`), WebSocket maison (`ws-lite.js`), comptes scrypt + JSON (`accounts.js`), guildes (`guilds.js`), 18 tests.
- **Jamais vu à l'écran** : le rendu 3D n'a été testé qu'avec un DOM/THREE simulés. Première chose à faire : lancer `npm start`, ouvrir http://localhost:8080 et corriger ce qui est visuellement faux.
- Dette connue : client en un seul fichier JS (à passer en TypeScript/Vite), données dupliquées dans le client (`SSH`, `SUP`, `REGN`), persistance JSON (à remplacer par SQL), pas de TLS.

## Objectif
Faire évoluer le projet vers un vrai MMORPG naval 3D, en TypeScript, en gardant le serveur autoritaire.

## Étapes (une à la fois, avec tests et commit à chaque étape)
1. **Environnement** : `npm install`, lancer `npm test`, corriger ce qui casse. Passer le client 3D sous Vite + TypeScript + Three.js (dépendance npm, plus de CDN), sans changer le gameplay.
2. **Vérification visuelle** : lancer le client 3D, vérifier océan, navires, caméra, tirs, port. Corriger les bugs (orientation des canons, échelle, lisibilité).
3. **Unifier les données** : `shared/data.js` devient la source unique (classes de navires du client 3D incluses : Corvette, Brick, Frégate, Frégate lourde, Vaisseau de ligne, Trois-ponts, Navire amiral). Ajouter des tests.
4. **Multijoueur** : brancher le client 3D sur `server/` (WebSocket), le serveur calcule tout, le client envoie des intentions (barre, voiles, tir bâbord/tribord) et interpole les snapshots. Afficher les autres joueurs avec leur pseudo. Ne jamais faire passer des bots pour des joueurs.
5. **Persistance** : comptes (pseudo + mot de passe haché), base SQLite/PostgreSQL pour or, XP, navires, améliorations. Sauvegarde côté serveur uniquement.
6. **Contenu** : vent, monstres marins, abordage, coffres, missions du jour, chat, factions, classements.
7. **Finition** : effets (écume, fumée, ciel), sons, caméra, performances (instancing, LOD), interface mobile.

## Règles impératives
- Toute la partie visible est en **français**.
- **Originalité** : aucun nom, asset, texte, interface ou chiffre copié d'un autre jeu. Noms de navires = grands navires français historiques (Soleil Royal, Bucentaure, Hermione, Redoutable, Belle Poule…).
- Le serveur est l'autorité : jamais de confiance envers le client (valider, limiter le débit, borner les valeurs).
- Pas de `innerHTML` avec des données joueur (injection) ; utiliser `textContent`.
- Pas de secrets dans le dépôt.
- Petites étapes, tests qui passent avant chaque commit, messages de commit en français.

Commence par l'étape 1, puis montre-moi ce que tu as fait avant de continuer.
