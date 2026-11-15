// Tests de la simulation autoritaire : physique, collisions, combat, récompenses, économie.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepShip, collideShip, windFactor } from '../shared/physics.ts';
import type { S2C } from '../shared/protocol.ts';
import { computeStats, SHIP_BY_ID, SHIPS } from '../shared/ships.ts';
import { buildWorld, islandHeight } from '../shared/world.ts';
import { BONUS_ZONES, isBonusDay, ZONE_BY_ID, ZONES } from '../shared/zones.ts';
import { dailyStart } from '../server/game/progress.ts';
import { shop } from '../server/game/economy.ts';
import { Zone } from '../server/game/Zone.ts';
import { createCharacter, newProfile } from '../server/profile.ts';
import type { PlayerLink } from '../server/types.ts';

function fakeLink(name: string, id: number): PlayerLink & { inbox: S2C[] } {
  const profile = newProfile(name);
  createCharacter(profile, 0, 'royal', 'bayonnaise');
  const inbox: S2C[] = [];
  return {
    inbox, accountId: id, name, profile,
    send: (m) => inbox.push(m), notify: (text) => inbox.push({ t: 'notice', text }), touch: () => {},
    zoneId: 'manche-1', entityId: 100000 + id, docked: true, port: 'brest', input: { sail: 0, rudder: 0 }, seq: 0,
    pvp: false, hpRatio: 1, sailRatio: 1, known: new Set(), deadTimer: 0, groupId: null, guildTag: null,
    nav: null, targetId: 0, attacking: false, fishing: false, fishTimer: 0, grade: 18, followLeader: null, fleetSlot: 0,
  };
}

test('catalogue : 14 navires historiques demandés, 7 classes, progression croissante', () => {
  const wanted = ['Le Soleil Royal', 'Le Bucentaure', 'L\'Hermione', 'Le Redoutable', 'Le Vengeur du Peuple', 'Le Couronne', 'Le Royal Louis', 'Le Tonnant', 'Le Suffren', 'Le Formidable', 'Le Duquesne', 'Le Duguay-Trouin', 'Le Napoléon', 'Le Saint-Michel'];
  for (const n of wanted) assert.ok(SHIPS.some((s) => s.name === n), n);
  assert.equal(new Set(SHIPS.filter((s) => !s.npcOnly && !s.era).map((s) => s.cls)).size, 7);
  assert.equal(SHIPS.filter((s) => s.era === 'moderne' && !s.npcOnly).length, 25, '25 navires modernes');
  const hp = (id: string) => computeStats(SHIP_BY_ID[id]).hp;
  assert.ok(hp('soleil_royal') > hp('royal_louis') && hp('royal_louis') > hp('redoutable') && hp('redoutable') > hp('hermione') && hp('hermione') > hp('bayonnaise'));
});

test('physique : le navire avance, tourne, et le vent de travers est plus rapide que le vent debout', () => {
  const st = computeStats(SHIP_BY_ID.bayonnaise);
  const k = { x: 0, z: 0, h: 0, speed: 0 };
  for (let i = 0; i < 200; i++) stepShip(k, st, { sail: 3, rudder: 0 }, { dir: Math.PI / 2, strength: 1 }, 0.05);
  assert.ok(k.z > 50 && Math.abs(k.x) < 1, 'avance vers +z');
  const h0 = k.h;
  stepShip(k, st, { sail: 3, rudder: 1 }, { dir: 0, strength: 1 }, 0.5);
  assert.ok(k.h < h0, 'barre à tribord : le cap diminue');
  assert.ok(windFactor(0, { dir: Math.PI / 2, strength: 1 }) > windFactor(0, { dir: Math.PI, strength: 1 }));
});

test('monde : génération déterministe, ports sur la terre, collisions avec les îles', () => {
  for (const z of ZONES) {
    const a = buildWorld(z), b = buildWorld(z);
    assert.equal(a, b);
    assert.ok(a.islands.length >= z.ports.length + 10, `${z.id} : assez d'îles`);
    for (const p of z.ports) assert.ok(islandHeight(a.islands.find((i) => i.port?.id === p.id)!, p.x, p.z) > 2);
  }
  const w = buildWorld(ZONE_BY_ID['manche-1']);
  const isl = w.islands[0];
  const st = computeStats(SHIP_BY_ID.bayonnaise);
  const k = { x: isl.x + isl.r * 0.3, z: isl.z, h: 0, speed: 10 };
  const shock = collideShip(k, st, w, ZONE_BY_ID['manche-1'].half);
  assert.ok(shock > 0, 'un navire sur la terre est repoussé');
});

test('combat : une bordée touche, coule un PNJ et rapporte or, XP et butin', () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  const link = fakeLink('Testeur', 1);
  zone.addPlayer(link);
  const me = zone.ships.get(link.entityId)!;
  // On place le joueur au large, cap au sud, et un sloop pirate à 150 m par bâbord.
  me.k.x = 0; me.k.z = 0; me.k.h = 0;
  for (const s of [...zone.ships.values()]) if (s.kind !== 'player') zone.ships.delete(s.id);
  zone.spawnNPC(true);
  const npc = [...zone.ships.values()].find((s) => s.kind === 'npc')!;
  npc.k.x = 150; npc.k.z = 0; npc.k.h = 0; npc.k.speed = 0;
  npc.ai!.mode = 'patrouille';
  npc.hp = 50;
  npc.stats = { ...npc.stats, speed: 0, turn: 0 };
  me.stats = { ...me.stats, dispersion: 0 };
  const orBefore = link.profile.or, xpBefore = link.profile.xp;
  zone.fire(me, 150, 0);
  assert.ok(me.reload[0] > 0);
  for (let i = 0; i < 80 && npc.sinking < 0; i++) {
    me.k.speed = 0; link.input = { sail: 0, rudder: 0 };
    zone.tick(0.05);
  }
  assert.ok(npc.sinking >= 0, 'le PNJ coule');
  assert.ok(link.profile.or > orBefore && link.profile.xp > xpBefore, 'récompenses versées');
  assert.equal(link.profile.stats.kills, 1);
  assert.ok([...zone.loot.values()].some((l) => l.kind === 'caisse'), 'une épave flottante est à repêcher');
});

test('PvP : interdit par défaut en Manche, autorisé quand les deux hissent le pavillon rouge, jamais au port', () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  const a = fakeLink('Alpha', 2), b = fakeLink('Bravo', 3);
  zone.addPlayer(a, false);
  zone.addPlayer(b, false);
  const sa = zone.ships.get(a.entityId)!, sb = zone.ships.get(b.entityId)!;
  sa.k.x = 0; sa.k.z = 0; sb.k.x = 100; sb.k.z = 0;
  assert.equal(zone.canHarm(sa, sb), false);
  a.pvp = b.pvp = true;
  assert.equal(zone.canHarm(sa, sb), true);
  const brest = ZONE_BY_ID['manche-1'].ports[0];
  sb.k.x = brest.x; sb.k.z = brest.z + 400;
  assert.equal(zone.canHarm(sa, sb), false, 'zone portuaire protégée');
});

test('économie : achats vérifiés côté serveur (niveau, fonds, port)', () => {
  const link = fakeLink('Marchand', 4);
  const z = ZONE_BY_ID['manche-1'];
  // Plus d'accostage : on achète en mer, mais il faut un port sur la carte.
  link.port = null;
  assert.match(shop(link, z, { a: 'buyShip', ship: 'cygne' }, 0)!, /port/);
  link.port = 'brest';
  assert.match(shop(link, z, { a: 'buyShip', ship: 'cygne' }, 0)!, /niveau/);
  link.profile.xp = 5000;
  link.profile.or = 10;
  assert.match(shop(link, z, { a: 'buyShip', ship: 'cygne' }, 0)!, /Fonds/);
  link.profile.or = 10000;
  assert.equal(shop(link, z, { a: 'buyShip', ship: 'cygne' }, 0), null);
  assert.equal(link.profile.or, 10000 - 4500);
  assert.equal(link.profile.ships.length, 2);
  assert.equal(shop(link, z, { a: 'buyShip', ship: 'spectre' }, 0), 'Navire inconnu.');
  // Commerce : acheter puis revendre ; la cale est limitée.
  assert.equal(shop(link, z, { a: 'trade', good: 'toile', qty: 10, buy: true }, 0), null);
  assert.equal(link.profile.cargo.toile, 10);
  assert.match(shop(link, z, { a: 'trade', good: 'toile', qty: 500, buy: true }, 0)!, /Cale pleine|Fonds/);
  assert.equal(shop(link, z, { a: 'trade', good: 'toile', qty: 10, buy: false }, 0), null);
  // Amélioration : consomme or et matériaux.
  const before = link.profile.mat.bois;
  assert.equal(shop(link, z, { a: 'upgrade', slot: 'coque' }, 0), null);
  assert.ok(link.profile.mat.bois < before);
});

test('souris : navigation au clic et attaque automatique d\'un PNJ ciblé', () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  const link = fakeLink('Clic', 7);
  zone.addPlayer(link, false);
  const me = zone.ships.get(link.entityId)!;
  for (const s of [...zone.ships.values()]) if (s.kind !== 'player') zone.ships.delete(s.id);
  me.k.x = 0; me.k.z = 0; me.k.h = 0; me.k.speed = 0;
  // « Va ici » : le navire avance seul et s'arrête à destination.
  link.nav = { x: 0, z: 400 };
  for (let i = 0; i < 20 * 60 && link.nav; i++) zone.tick(0.05);
  assert.equal(link.nav, null, 'arrivé');
  assert.ok(Math.hypot(me.k.x, me.k.z - 400) < 60);
  // Attaque : on cible un PNJ immobile à 250 m ; le navire manœuvre et tire seul.
  zone.spawnNPC(true);
  const npc = [...zone.ships.values()].find((s) => s.kind === 'npc')!;
  npc.k.x = me.k.x + 250; npc.k.z = me.k.z; npc.stats = { ...npc.stats, speed: 0, turn: 0 }; npc.dmgMul = 0;
  link.targetId = npc.id; link.attacking = true;
  const hp0 = npc.hp;
  for (let i = 0; i < 20 * 40 && npc.hp === hp0; i++) zone.tick(0.05);
  assert.ok(npc.hp < hp0, 'le PNJ a été touché par l\'attaque automatique');
});

test('cartes et équipement : 15 cartes (1/1 à 5/2 puis 6 à 10), ports propres, canons installés plus puissants', () => {
  assert.equal(ZONES.length, 15);
  assert.deepEqual(ZONES.map((z) => z.code).slice(10), ['6', '7', '8', '9', '10']);
  assert.deepEqual(ZONES.map((z) => z.code).slice(0, 12), ['1/1', '1/2', '2/1', '2/2', '3/1', '3/2', '4/1', '4/2', '5/1', '5/2', '6', '7']);
  assert.equal(ZONES.at(-1)!.code, '10');
  assert.notDeepEqual(ZONE_BY_ID['manche-1'].ports.map((p) => p.name), ZONE_BY_ID['manche-2'].ports.map((p) => p.name));
  const def = SHIP_BY_ID.bayonnaise;
  const base = computeStats(def).broadside;
  assert.ok(computeStats(def, undefined, undefined, { c60: 20 }).broadside > computeStats(def, undefined, undefined, { c30: 20 }).broadside);
  assert.ok(computeStats(def, undefined, undefined, { c30: 20 }).broadside > base);
  const link = fakeLink('Armurier', 8);
  link.profile.perles = 10;
  assert.equal(shop(link, ZONE_BY_ID['manche-1'], { a: 'buyEquip', item: 'c50', qty: 5 }, 0), null);
  assert.equal(shop(link, ZONE_BY_ID['manche-1'], { a: 'install', item: 'c50', qty: 50 }, 0), null);
  assert.equal(link.profile.ships[0].fit?.c50, 5);
  assert.match(shop(link, ZONE_BY_ID['manche-1'], { a: 'buyEquip', item: 'c60', qty: 1 }, 0)!, /Fonds/);
});

test('livraison 2 : monstres, coffres, îles fortifiées, boutique, missions, grades', () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  // Coffres flottants et tours d'îles fortifiées présents dès le départ.
  assert.ok([...zone.loot.values()].some((l) => l.kind === 'coffre'));
  const towers = [...zone.forts.values()].filter((f) => f.def.faction === 'pirate');
  assert.equal(towers.length % 3, 0);
  assert.ok(towers.length >= 3);
  // Un monstre mord au contact.
  const link = fakeLink('Testeur2', 9);
  zone.addPlayer(link, false);
  const me = zone.ships.get(link.entityId)!;
  for (const s of [...zone.ships.values()]) if (s.kind !== 'player') zone.ships.delete(s.id);
  me.k.x = 0; me.k.z = 0;
  const hp0 = me.hp + me.shield;
  const croco = { ...me, id: 999999, kind: 'npc' as const, def: SHIP_BY_ID.crocodile, faction: 'monstre' as const, link: undefined, reload: [0, 0] as [number, number], level: 3 };
  zone.bite(croco, me);
  assert.ok(me.hp + me.shield < hp0, 'morsure');
  // Boutique : harpon sur une cible.
  zone.spawnNPC(true);
  const npc = [...zone.ships.values()].find((s) => s.kind === 'npc')!;
  npc.k.x = 100; npc.k.z = 0;
  link.profile.items.harpon_or = 1;
  link.targetId = npc.id;
  const nhp = npc.hp;
  assert.equal(zone.useItem(me, 'harpon_or'), null);
  assert.ok(npc.hp < nhp || npc.sinking >= 0);
  assert.equal(link.profile.items.harpon_or, 0);
  // Grade de tir et points élite gagnés en infligeant des dégâts.
  assert.ok(link.profile.shootXp > 0 && link.profile.elite > 0);
  // Mission quotidienne : une seule à la fois, puis délai de 12 h.
  assert.equal(dailyStart(link, 'monstres', 1), null);
  assert.match(dailyStart(link, 'pirates', 1)!, /une seule/i);
});

test('cartes bonus : fermées hors du dimanche, ouvertes le dimanche', () => {
  assert.equal(BONUS_ZONES.length, 3);
  assert.equal(isBonusDay(new Date('2026-11-15T12:00:00+01:00')), true); // dimanche
  assert.equal(isBonusDay(new Date('2026-11-16T12:00:00+01:00')), false); // lundi
});

test('niveaux élite : un navire élite progresse avec les points élite et a sa spécialité', async () => {
  const { eliteLevel, eliteBonus } = await import('../shared/elite.ts');
  assert.equal(eliteLevel(0).level, 1);
  assert.equal(eliteLevel(80000).level, 3);
  assert.equal(eliteLevel(1e9).level, 15);
  const def = SHIP_BY_ID.aigle_blanc;
  const low = computeStats(def, undefined, undefined, undefined, eliteBonus(def, 0));
  const high = computeStats(def, undefined, undefined, undefined, eliteBonus(def, 1e9));
  assert.ok(high.hp > low.hp && high.broadside > low.broadside && high.harpon > low.harpon);
  assert.ok(low.range > computeStats(def).range, 'spécialité de l\'Aigle Blanc : portée');
  assert.deepEqual(eliteBonus(SHIP_BY_ID.bayonnaise, 1e9), {}, 'aucun bonus élite pour un navire ordinaire');
});

test('bouclier, énergie et compétences actives : vraies mécaniques côté serveur', () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  const link = fakeLink('Bouclier', 21);
  zone.addPlayer(link, false);
  const me = zone.ships.get(link.entityId)!;
  // Le bouclier encaisse avant la coque.
  assert.ok(me.shieldMax > 0 && me.shield === me.shieldMax);
  const hp0 = me.hp;
  zone.damage(me, 50, 0, 'rond', null, false);
  assert.equal(me.hp, hp0, 'la coque est intacte tant que le bouclier tient');
  assert.ok(me.shield < me.shieldMax);
  zone.damage(me, me.shieldMax + 50, 0, 'rond', null, false);
  assert.ok(me.shield === 0 && me.hp < hp0, 'une fois le bouclier vidé, la coque prend');
  // Compétence : coûte de l'énergie, puis temps de recharge.
  const e0 = me.energy;
  me.reload[0] = 3;
  assert.equal(zone.useSkill(me, 'bordee'), null);
  assert.equal(me.reload[0], 0, 'canons rechargés');
  assert.ok(me.fx.dmg > 0 && me.energy < e0);
  assert.match(zone.useSkill(me, 'bordee')!, /encore/);
  // Niveau requis.
  assert.match(zone.useSkill(me, 'precision')!, /niveau/);
  // L'énergie se régénère.
  const e1 = me.energy;
  for (let i = 0; i < 40; i++) zone.tick(0.05);
  assert.ok(me.energy > e1);
});

test('régions : chaque région a son boss, ses ennemis, sa ressource ; la Mer Égée est la carte de guerre de la Méditerranée', async () => {
  const { REGIONS } = await import('../shared/regions.ts');
  const { SEAS } = await import('../shared/zones.ts');
  for (const s of SEAS) assert.ok(REGIONS.some((r) => r.seas.includes(s.id)), `mer sans région : ${s.id}`);
  for (const r of REGIONS) {
    assert.ok(SHIP_BY_ID[r.boss.ship], `boss inconnu : ${r.boss.ship}`);
    for (const n of r.npcs) assert.ok(SHIP_BY_ID[n.ship], `PNJ inconnu : ${n.ship}`);
  }
  const egee = ZONE_BY_ID['mediterranee-2'];
  assert.equal(egee.name, 'Mer Égée');
  assert.ok(egee.ports.some((p) => p.name === 'Candie'));
  assert.ok(egee.enemies.some((e) => e.ship === 'galere_barbaresque'));
  assert.ok(ZONE_BY_ID['manche-1'].ports.every((p) => p.produces.includes('toile')));
  // Boss régional : le Dragon des Typhons apparaît en mer de Chine et la simulation tourne.
  const chine = ZONES.find((z) => z.sea === 'mer_de_chine')!;
  const zone = new Zone(chine, { relation: () => 'neutral' });
  (zone as unknown as { spawnBoss(): void }).spawnBoss();
  const boss = [...zone.ships.values()].find((s) => s.kind === 'boss')!;
  assert.equal(boss.def.id, 'dragon_typhons');
  for (let i = 0; i < 40; i++) zone.tick(0.05);
});

test('atelier et saison : fabriquer une compétence la renforce ; couler un PNJ donne des points de saison', async () => {
  const { seasonPoints } = await import('../shared/season.ts');
  const link = fakeLink('Artisan', 31);
  link.docked = true;
  const p = link.profile;
  // Sans ressources : refus.
  p.or = 0;
  assert.match(shop(link, ZONE_BY_ID['manche-1'], { a: 'craftSkill', skill: 'bordee' }, 0)!, /insuffisantes/);
  p.or = 1e6; p.ferraille = 500; p.perles = 50; p.mat = { bois: 500, toile: 500, fer: 500 };
  assert.equal(shop(link, ZONE_BY_ID['manche-1'], { a: 'craftSkill', skill: 'bordee' }, 0), null);
  assert.equal(p.skillLv.bordee, 2);
  // En mer, la compétence niveau 2 dure plus longtemps et recharge plus vite.
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  zone.addPlayer(link, false);
  const me = zone.ships.get(link.entityId)!;
  assert.equal(zone.useSkill(me, 'bordee'), null);
  assert.ok(me.fx.dmg > 8 && me.skillCd.bordee! < 25);
  // Points de saison en coulant un PNJ.
  for (const s of [...zone.ships.values()]) if (s.kind !== 'player') zone.ships.delete(s.id);
  zone.spawnNPC(true);
  const npc = [...zone.ships.values()].find((s) => s.kind === 'npc')!;
  const before = seasonPoints(p.season);
  zone.damage(npc, npc.stats.hp * 10, 0, 'rond', me, false);
  assert.ok(seasonPoints(p.season) > before);
});

test('escadre et raid : suivre le chef en formation, bonus d\'escadre, combat libre pendant un raid', async () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: (a, b) => (a.groupId && a.groupId === b.groupId ? 'friend' : 'neutral') });
  const chef = fakeLink('Chef', 41), suiveur = fakeLink('Suiveur', 42), autre = fakeLink('Autre', 43);
  chef.groupId = suiveur.groupId = 'g1';
  for (const l of [chef, suiveur, autre]) zone.addPlayer(l, false);
  for (const s of [...zone.ships.values()]) if (s.kind !== 'player') zone.ships.delete(s.id);
  const A = zone.ships.get(chef.entityId)!, B = zone.ships.get(suiveur.entityId)!, C = zone.ships.get(autre.entityId)!;
  A.k.x = 0; A.k.z = 0; A.k.h = 0; B.k.x = 300; B.k.z = -300; C.k.x = -3000; C.k.z = -3000;
  // Le suiveur rejoint sa place derrière le chef.
  suiveur.followLeader = 'Chef'; suiveur.fleetSlot = 1;
  const d0 = Math.hypot(B.k.x - A.k.x, B.k.z - A.k.z);
  for (let i = 0; i < 20 * 70; i++) zone.tick(0.05);
  const d1 = Math.hypot(B.k.x - A.k.x, B.k.z - A.k.z);
  assert.ok(d1 < d0 && d1 < 230, `le suiveur se rapproche de la formation (${Math.round(d0)} -> ${Math.round(d1)} m)`);
  // Bonus d'escadre : un allié proche.
  assert.equal(zone.fleetAllies(A), 1);
  assert.equal(zone.fleetAllies(C), 0);
  // Raid : sur une carte calme, le combat entre joueurs devient libre.
  C.k.x = A.k.x + 900; C.k.z = A.k.z;
  assert.equal(zone.canHarm(A, C), false);
  zone.raidActive = true;
  assert.equal(zone.canHarm(A, C), true);
  assert.equal(zone.canHarm(A, B), false, 'jamais contre son propre groupe');
});

test('raid de guilde : les points vont aux guildes, la gagnante prend la carte ; un territoire rapporte de l\'or', async () => {
  const { Hub } = await import('../server/Hub.ts');
  const { openStore } = await import('../server/db.ts');
  const store = openStore(':memory:');
  const hub = new Hub(store);
  const zid = 'manche-2';
  hub.forceRaid(zid);
  const z = hub.zones.get(zid)!;
  assert.equal(z.raidActive, true);
  const a = fakeLink('Raideur', 51), b = fakeLink('Rival', 52);
  a.guildTag = 'ROI'; b.guildTag = 'MER';
  const hooks = (z as unknown as { hooks: { onPvpKill(z: unknown, k: unknown, v: unknown): void; onKill(z: unknown, l: unknown): void } }).hooks;
  hooks.onPvpKill(z, a, b);
  hooks.onPvpKill(z, a, b);
  hooks.onPvpKill(z, b, a);
  assert.deepEqual(hub.raidInfo().scores.map((x) => x.tag), ['ROI', 'MER']);
  hub.finishRaid();
  assert.equal(z.raidActive, false);
  assert.equal(hub.owners.get(zid), 'ROI');
  // Le territoire est enregistré : un serveur redémarré le retrouve.
  assert.equal(new Hub(store).owners.get(zid), 'ROI');
});

test('tutoriel : les étapes se valident dans l\'ordre et rapportent leur récompense', async () => {
  const { TUTORIAL } = await import('../shared/tutorial.ts');
  const { tutorialEvent } = await import('../server/game/progress.ts');
  const link = fakeLink('Novice', 61);
  link.profile.tutorial = 0;
  const or0 = link.profile.or;
  tutorialEvent(link, 'kill'); // pas encore : il faut d'abord naviguer
  assert.equal(link.profile.tutorial, 0);
  for (const st of TUTORIAL) tutorialEvent(link, st.kind);
  assert.equal(link.profile.tutorial, TUTORIAL.length);
  assert.ok(link.profile.or > or0);
  // Un ancien capitaine (profil sans champ tutoriel) ne le voit pas ; un nouveau le commence.
  const { sanitizeProfile, newProfile } = await import('../server/profile.ts');
  const old = { ...link.profile } as Partial<typeof link.profile>;
  delete old.tutorial;
  assert.equal(sanitizeProfile(old as typeof link.profile, 'Novice').tutorial, TUTORIAL.length);
  assert.equal(sanitizeProfile(newProfile('Nouveau'), 'Nouveau').tutorial, 0);
});

test('sans port : on démarre en mer immobile, et un navire coulé est renfloué en mer', () => {
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  const link = fakeLink('Naufrage', 71);
  zone.addPlayer(link);
  assert.equal(link.docked, false);
  const me = zone.ships.get(link.entityId)!;
  assert.equal(link.input.sail, 0, 'le navire attend les ordres');
  zone.damage(me, me.stats.hp * 50, 0, 'rond', null, false);
  assert.ok(me.sinking >= 0);
  for (let i = 0; i < 20 * 40 && link.deadTimer > 0; i++) zone.tick(0.05);
  const again = zone.ships.get(link.entityId)!;
  assert.ok(again && again.sinking < 0, 'navire renfloué');
  assert.equal(link.docked, false, 'toujours en mer, pas au port');
  assert.equal(again.hp, again.stats.hp);
});

test('livrées élites : le niveau élite du navire est transmis aux autres capitaines', async () => {
  const { giveShip } = await import('../server/profile.ts');
  const { ELITE_LIVERIES, eliteLook } = await import('../shared/elite.ts');
  assert.equal(ELITE_LIVERIES.length, 15);
  assert.notEqual(eliteLook(SHIP_BY_ID.etoile_roi.look, 1).sail, eliteLook(SHIP_BY_ID.etoile_roi.look, 15).sail);
  const zone = new Zone(ZONE_BY_ID['manche-1'], { relation: () => 'neutral' });
  const veteran = fakeLink('Veteran', 81), voisin = fakeLink('Voisin', 82);
  veteran.profile.active = giveShip(veteran.profile, 'etoile_roi').uid;
  veteran.profile.elite = 60_000_000; // niveau élite 14
  zone.addPlayer(veteran);
  zone.addPlayer(voisin);
  const A = zone.ships.get(veteran.entityId)!, B = zone.ships.get(voisin.entityId)!;
  B.k.x = A.k.x + 50; B.k.z = A.k.z;
  zone.broadcast(0.5);
  const meta = voisin.inbox.filter((m) => m.t === 'meta').flatMap((m) => (m.t === 'meta' ? m.list : [])).find((x) => x.id === veteran.entityId);
  assert.equal(meta?.elite, 14);
  const metaVoisin = veteran.inbox.filter((m) => m.t === 'meta').flatMap((m) => (m.t === 'meta' ? m.list : [])).find((x) => x.id === voisin.entityId);
  assert.equal(metaVoisin?.elite ?? 0, 0, 'navire non élite : pas de livrée');
});
