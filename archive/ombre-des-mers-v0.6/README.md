# Empire des Mers — MMORPG naval français (prototype jouable)

Jeu de combat naval 3D à l'époque de la marine à voile, 100 % français et original
(noms de navires historiques : Soleil Royal, Bucentaure, Redoutable…).

## Lancer en ligne (multijoueur)
```
npm start            # aucune dépendance à installer (Node >= 22)
```
Puis ouvrir http://localhost:8080 — le serveur sert le client 3D et gère les comptes.
Autres joueurs : même adresse (réseau local) ou machine publique. Sauvegarde : `data/players.json`.
Variables : `PORT`, `DATA_FILE`. Le client charge Three.js depuis cdnjs (internet requis côté navigateur).

## Solo
Ouvrir `client3d/index.html` dans un navigateur (sans serveur) : mode solo avec sauvegarde locale.
`client/index.html` = ancien prototype 2D.

## Commandes
Z avancer · S ralentir · Q/D tourner · J feu bâbord · L feu tribord · Espace double bordée · P port ·
souris : glisser = caméra, molette = zoom · Entrée = chat.

## Guildes (chat)
`/guilde creer NOM TAG` (1000 or) · `inviter PSEUDO` · `accepter` · `quitter` · `expulser PSEUDO` ·
`alliance GUILDE` · `guerre GUILDE` · `paix GUILDE` · `info`. Alliés protégés ; en guerre, primes doublées.

## Tests
`npm test` : simulation, réseau, comptes, guildes, client 3D branché au vrai serveur (DOM simulé).
**Non testé** : le rendu 3D réel (aucun navigateur disponible lors du développement), la charge (>2 joueurs réels).

## Architecture
`server/sim.js` (monde pur, autoritaire) · `server/index.js` (réseau, comptes, chat) · `server/ws-lite.js` (WebSocket sans dépendance) ·
`server/guilds.js` · `server/accounts.js` · `shared/data.js` · `client3d/index.html`.
