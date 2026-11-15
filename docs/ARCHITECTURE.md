# Architecture technique

## Choix technologiques

| Besoin | Choix | Pourquoi |
|---|---|---|
| Rendu 3D navigateur | **Three.js** (r170) | Le plus répandu, shaders sur mesure faciles (océan, voiles, coques), excellent sur PC. |
| Interface | **React 18** | Écrans riches (port, chantier, guilde…) ; mis à jour à 10 Hz seulement pour ne pas freiner la 3D. |
| Langage | **TypeScript** partout | Les mêmes types et les mêmes règles (`shared/`) côté client et serveur. |
| Serveur | **Node.js 22** + `ws` | Simple, rapide, même langage que le client. |
| Temps réel | **WebSocket**, JSON compact | Suffisant pour le prototype ; passage au binaire prévu (voir plus bas). |
| Base de données | **SQLite intégré à Node** (`node:sqlite`) | Zéro installation. L'interface `Store` (`server/db.ts`) permet de passer à PostgreSQL / Supabase. |
| Construction | **Vite** | Compilation du client en quelques secondes. |

## Vue d'ensemble

```
 Navigateur (client)                                   Serveur Node.js
 ┌───────────────────────────────┐   WebSocket    ┌──────────────────────────────────────┐
 │ React : HUD, port, panneaux   │  intentions →  │ Hub : sessions, chat, groupes,       │
 │ Game  : boucle de rendu       │ ← instantanés  │       guildes, sauvegarde, routage   │
 │   · prédiction du navire      │   20 / s       │   ├─ Zone « Manche »     (20 Hz)     │
 │   · interpolation des autres  │                │   ├─ Zone « Atlantique » (endormie)  │
 │   · effets, sons, étiquettes  │   HTTP         │   ├─ …  7 zones = 7 « shards »       │
 │ Three.js : océan, ciel, îles, │  /api/login    │   └─ Store (SQLite) : comptes,       │
 │   navires, particules         │  /api/classement│        profils, sessions, guildes    │
 └───────────────────────────────┘                └──────────────────────────────────────┘
                 ▲                                              ▲
                 └────────────── shared/ (TypeScript) ──────────┘
     navires · munitions · zones · génération du monde · physique · protocole
```

## Serveur autoritaire (anti-triche)

- Le client n'envoie que : barre et voilure (`input`), point visé (`fire`), choix de munition, achats,
  messages de chat. Tout est **borné et validé** (`server/Hub.ts`) ; débit limité par connexion,
  messages de 4 Ko maximum, flood = déconnexion.
- La zone simule à 20 Hz : navigation (`shared/physics.ts`), collisions avec le relief réel des îles,
  boulets (balistique avec sous-pas), dégâts, incendies, réparations, IA, forts, butin, boss, météo.
- Rechargement, munitions, or, XP, niveau, achats : décidés et vérifiés **uniquement** côté serveur.
- Mots de passe : scrypt + sel ; jetons de session aléatoires ; même coût de calcul si le compte n'existe pas.

## Réseau

- **Instantanés** à 20 Hz, limités par **gestion d'intérêt** : chaque joueur ne reçoit que ce qui se trouve
  dans un rayon de 1,9 km (`VIEW_RADIUS`). Les fiches (nom, navire, blason) ne sont envoyées qu'une fois.
- Les boulets ne sont pas diffusés à chaque image : le serveur envoie l'événement de bordée
  (positions et vitesses initiales), chaque client calcule la même trajectoire.
- Client : **prédiction** du propre navire (même code physique que le serveur) avec correction douce,
  **interpolation** des autres entités avec 120 ms de retard, file d'événements synchronisée sur l'horloge serveur.

## Pensé pour devenir un MMORPG

- Chaque mer est une `Zone` indépendante qui ne partage rien d'autre que le Hub : on peut les répartir
  dans plusieurs processus ou machines (un processus par zone + un routeur de connexions + Redis pour le chat
  et les guildes). Une zone vide s'endort et ne consomme rien.
- Le monde est **déterministe** (graine par zone) : client et serveur génèrent les mêmes îles, sans transfert.
- Les données d'équilibrage sont centralisées dans `shared/` (navires, munitions, zones, progression).

## Étapes suivantes recommandées

1. Messages binaires (ArrayBuffer) et compression delta des instantanés.
2. Grille spatiale pour la gestion d'intérêt (aujourd'hui une boucle, suffisante pour quelques centaines d'entités).
3. PostgreSQL (ou Supabase) derrière l'interface `Store`, sauvegardes transactionnelles.
4. Un processus par zone, passerelle WebSocket, chat/guildes via Redis.
5. Modèles glTF réalisés par un artiste, musique originale, version mobile.
6. Abordage, flottes d'escorte, guerres de guildes avec prise de ports, événements saisonniers.
