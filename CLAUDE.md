# Empire des Mers — contexte pour Claude Code

MMORPG naval 3D en français (marine française, XVIIe–XIXe siècle). Projet d'Alex : répondre **en français**,
simplement, en expliquant les choix techniques.

## Commandes
- `npm start` : compile le client (Vite) et lance le serveur sur http://localhost:8080
- `npm run dev` : serveur (tsx watch) + client Vite sur http://localhost:5173 (proxy /api et /ws)
- `npm test` : tests node:test (serveur réel + simulation) ; `npm run typecheck`
- `npm run e2e` : deux navigateurs Playwright contre un serveur déjà lancé

## Carte du code
- `shared/` : source de vérité commune — `ships.ts` (catalogue, `computeStats`), `items.ts`, `zones.ts`,
  `world.ts` (génération déterministe des îles + `islandHeight`), `physics.ts` (navigation, balistique), `protocol.ts`.
- `server/` : `index.ts` (HTTP + WS), `Hub.ts` (sessions, chat, guildes, groupes, routage), `game/Zone.ts`
  (simulation 20 Hz par mer), `game/ai.ts`, `game/economy.ts`, `game/missions.ts`, `db.ts` (interface `Store`, SQLite).
- `client/src/game/` : `Game.ts` (boucle, prédiction, interpolation, visée, événements), `render/` (Ocean, SkyEnv,
  ShipModel, WorldBuilder, Particles, Effects, textures, waves), `CameraRig.ts`, `Input.ts`, `Audio.ts`.
- `client/src/ui/` : React (Login, Create, Hud, Port, Panels) ; état dans `client/src/store.ts`.

## Règles
1. Le serveur fait autorité : le client n'envoie que des intentions. Toute entrée est bornée et validée.
2. Les nombres d'équilibrage vivent dans `shared/`.
3. Textes affichés via React ou `textContent` ; jamais de HTML brut issu des joueurs.
4. Les PNJ restent identifiés « (PNJ) » ; ne jamais les faire passer pour des joueurs.
5. Graphismes, noms et textes originaux : on s'inspire des principes des jeux navals, pas de leurs ressources.
6. Repère : x est, z sud, cap h avec avant = (sin h, cos h) ; bâbord = +x local du navire.
