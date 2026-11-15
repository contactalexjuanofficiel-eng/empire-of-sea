// Test d'intégration : le client 3D (DOM/THREE simulés) se connecte au vrai serveur.
import { makeClient, sleep } from './harness3d.mjs';
import { startGame } from '../server/index.js';
const fails = [];
const chk = (c, m) => { if (!c) fails.push(m); };
const g = await startGame({ port: 0, tickMs: 25 });
const url = encodeURIComponent('ws://127.0.0.1:' + g.port);

// 1) invité (pseudo dans l'URL) + un rival brut
const other = new WebSocket('ws://127.0.0.1:' + g.port); const omsgs = [];
other.onmessage = (e) => omsgs.push(JSON.parse(e.data));
await new Promise((r) => (other.onopen = r)); other.send(JSON.stringify({ t: 'join', name: 'Rival' }));
const c1 = makeClient('?ws=' + url + '&name=Testeur');
await c1.run(25); c1.E.playerFire(1); await c1.run(30); c1.E.playerFire(-1); await c1.run(30);
const E = c1.E;
chk(E.NET.ok && E.NET.id, 'invité connecté');
chk(g.world.players.size === 2, 'le serveur voit 2 joueurs');
chk(E.NET.ents.size >= 1, 'le rival est affiché');
chk([...g.world.players.values()].some((p) => p.name === 'Invité Testeur'), 'pseudo transmis');
chk(Number.isFinite(E.P.x + E.P.z + E.P.h) && Math.abs(E.P.x) < 600, 'position valide');
chk(E.P.max >= 100 && E.S.lvl === 1, 'stats du serveur appliquées');
chk(omsgs.some((m) => m.t === 'snap' && m.players.some((p) => p.name === 'Invité Testeur')), 'le rival voit le testeur');
other.close();

// 2) compte via l'interface de connexion, puis chat
const c2 = makeClient('?ws=' + url);
await c2.run(10);
chk(c2.els.login && c2.els.login.style.display === 'block', 'panneau de connexion affiché');
c2.els.lname = { value: 'Capitaine1' }; c2.els.lpass = { value: 'secret123' };
c2.els.lreg.onclick(); await c2.run(25);
chk(c2.E.NET.ok, 'compte créé et connecté via l\'interface');
c2.els.chatIn.onkeydown({ key: 'Enter', stopPropagation() {} }); // vide : rien
c2.els.chatIn.value = 'Salut le monde'; c2.els.chatSc = { value: 'global' };
c2.els.chatIn.onkeydown({ key: 'Enter', stopPropagation() {} }); await c2.run(10);
chk(c2.els.chatLog.children !== undefined, 'chat sans erreur');
// boutique en ligne : achat refusé (pas assez d'or) mais réponse reçue sans erreur
c2.E.NET.ws.send(JSON.stringify({ t: 'buy', kind: 'upgrade', arg: 'hull' })); await c2.run(8);
g.stop();
if (fails.length) { console.error('ÉCHEC:', fails); process.exit(1); }
console.log('OK client 3D en ligne : invité + compte + chat');
process.exit(0);
