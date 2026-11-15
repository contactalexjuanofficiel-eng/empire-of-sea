// Le Hub relie les connexions WebSocket aux zones, gère le chat, les groupes, les guildes et la sauvegarde.
import { seasonPoints } from '../shared/season.ts';
import { ACTIVE_SKILL_BY_ID } from '../shared/combat.ts';
import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { AMMO, CONSUMABLES } from '../shared/items.ts';
import { levelFromXp } from '../shared/progression.ts';
import { assignGrades, GRADES, rankPoints } from '../shared/ranks.ts';
import { PROTOCOL_VERSION, TICK_RATE, type C2S, type ChatChannel, type GuildInfo, type LeaderEntry, type MissionOffer, type Profile, type S2C } from '../shared/protocol.ts';
import { SHIP_BY_ID } from '../shared/ships.ts';
import { BONUS_ZONES, isBonusDay, MAX_TIER, START_ZONE, tierRequirement, ZONE_BY_ID, ZONES } from '../shared/zones.ts';
import type { Store } from './db.ts';
import { acceptMission, portPrices, shop } from './game/economy.ts';
import { dailyAbandon, dailyStart } from './game/progress.ts';
import { missionOffers } from './game/missions.ts';
import { allocId, DAY_SECONDS, Zone } from './game/Zone.ts';
import { activeShip, createCharacter, newProfile, playerLevel, sanitizeProfile } from './profile.ts';
import { GUILD_COST, Guilds } from './social/guilds.ts';
import type { PlayerLink } from './types.ts';

interface Session extends PlayerLink {
  ws: WebSocket;
  dirty: boolean;
  sentProfileAt: number;
  savedAt: number;
  lastChat: number;
  msgBudget: number;
  offers: MissionOffer[];
  created: boolean;
  lastHardBonus: number;
}

interface Group { id: string; leader: string; members: Set<string> }

const lc = (s: string) => s.toLowerCase();
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const num = (v: unknown, a: number, b: number, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d);

export class Hub {
  readonly zones = new Map<string, Zone>();
  readonly sessions = new Map<number, Session>(); // par compte
  private byName = new Map<string, Session>();
  readonly guilds: Guilds;
  private groups = new Map<string, Group>();
  private groupInvites = new Map<string, string>();
  private timer: NodeJS.Timeout | null = null;
  /** Guilde qui contrôle chaque carte (dernier boss vaincu). */
  readonly owners = new Map<string, string>();
  private mapsTimer = 0;
  private gradeTimer = 2;
  private last = performance.now();

  constructor(private store: Store) {
    this.guilds = new Guilds(store);
    for (const def of [...ZONES, ...BONUS_ZONES]) {
      this.zones.set(def.id, new Zone(def, {
        relation: (a, b) => this.relation(a, b),
        broadcastChat: (text) => this.systemAll(text),
        onKill: (z, l) => this.tierProgress(z, l as Session),
        onConquest: (z, l) => {
          const tag = this.guilds.of(l.name)?.tag ?? null;
          if (!tag) return;
          this.owners.set(z.def.id, tag);
          this.systemAll(`La guilde [${tag}] prend le contrôle de la carte ${z.def.code} (${z.def.name}) !`);
        },
      }));
    }
  }

  start() {
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }
  private stopped = false;
  stop() {
    if (this.timer) clearInterval(this.timer);
    for (const s of this.sessions.values()) this.save(s);
    this.stopped = true;
    for (const s of this.sessions.values()) s.ws.terminate();
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const t = Date.now() / 1000;
    for (const z of this.zones.values()) {
      z.tick(dt);
      z.broadcast((t / DAY_SECONDS + z.def.ambiance.timeOffset) % 1);
    }
    this.gradeTimer -= dt;
    if (this.gradeTimer <= 0) { this.gradeTimer = 60; this.computeGrades(); }
    this.mapsTimer -= dt;
    if (this.mapsTimer <= 0) {
      this.mapsTimer = 3;
      const open = isBonusDay();
      const list = [...this.zones.values()].map((z) => ({ id: z.def.id, players: z.links.size, owner: this.owners.get(z.def.id) ?? null, ...(z.def.bonus ? { kills: z.bonusKills, bossAt: z.def.bonus.bossAfter, boss: !!z.bossId, open } : {}) }));
      // Lundi : les capitaines encore sur une carte bonus rentrent sur leur carte habituelle.
      if (!open) for (const z of this.zones.values()) if (z.def.bonus) for (const l of [...z.links.values()]) this.relocate(l as Session, ZONES.filter((x) => x.tier === Math.min(l.profile.tier, MAX_TIER))[0].id, 'Les cartes bonus sont fermées jusqu\'à dimanche prochain.');
      for (const s of this.sessions.values()) s.send({ t: 'maps', list });
    }
    for (const s of this.sessions.values()) {
      s.msgBudget = Math.min(80, s.msgBudget + 60 * dt);
      if (s.dirty && now - s.sentProfileAt > 250) {
        s.dirty = false;
        s.sentProfileAt = now;
        s.send({ t: 'profile', p: s.profile });
        if (s.docked) this.sendPort(s);
      }
      if (now - s.savedAt > 15000) this.save(s);
    }
  }

  private save(s: Session) {
    s.savedAt = performance.now();
    if (s.created) this.store.saveProfile(s.accountId, s.profile);
  }

  relation(a: PlayerLink, b: PlayerLink): 'friend' | 'neutral' | 'war' {
    if (a.groupId && a.groupId === b.groupId) return 'friend';
    return this.guilds.relation(a.name, b.name);
  }

  // ------------------------------------------------------------------ connexion
  attach(ws: WebSocket, accountId: number) {
    const name = this.store.accountName(accountId)!;
    const old = this.sessions.get(accountId);
    if (old) {
      old.send({ t: 'err', text: 'Connexion depuis un autre endroit.' });
      old.ws.close();
      this.detach(old);
    }
    const raw = this.store.loadProfile(accountId);
    const profile = raw ? sanitizeProfile(raw, name) : newProfile(name);
    const s: Session = {
      ws, accountId, name, profile,
      send: (msg: S2C) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); },
      notify: (text, kind = 'info') => s.send({ t: 'notice', text, kind }),
      touch: () => { s.dirty = true; },
      zoneId: profile.zone, entityId: allocId(), docked: true, port: profile.port,
      input: { sail: 0, rudder: 0 }, seq: 0, pvp: false, hpRatio: 1, sailRatio: 1,
      known: new Set(), deadTimer: 0, groupId: null, guildTag: this.guilds.of(name)?.tag ?? null,
      nav: null, targetId: 0, attacking: false, fishing: false, fishTimer: 0, grade: 18,
      dirty: false, sentProfileAt: 0, savedAt: performance.now(), lastChat: 0, msgBudget: 80, offers: [], created: profile.created, lastHardBonus: 0,
    };
    this.sessions.set(accountId, s);
    this.byName.set(lc(name), s);
    ws.on('message', (data, isBinary) => {
      if (isBinary) return;
      s.msgBudget -= 1;
      if (s.msgBudget < 0) { if (s.msgBudget < -200) ws.close(1008, 'flood'); return; }
      let msg: C2S;
      try { msg = JSON.parse(String(data)); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
      try { this.handle(s, msg); } catch (e) { console.error('Erreur de traitement', e); }
    });
    ws.on('close', () => this.detach(s));
    if (!profile.created) s.send({ t: 'need_create', name });
    else this.enter(s);
  }

  private enter(s: Session) {
    if (ZONE_BY_ID[s.profile.zone]?.bonus && !isBonusDay()) {
      const def = ZONES.filter((x) => x.tier === Math.min(s.profile.tier, MAX_TIER))[0];
      s.profile.zone = def.id;
      s.port = s.profile.port = def.ports[0].id;
    }
    const zone = this.zones.get(s.profile.zone) ?? this.zones.get(START_ZONE)!;
    zone.addPlayer(s, true);
    s.send({ t: 'welcome', id: s.entityId, name: s.name, profile: s.profile, zone: zone.def.id, port: s.port, st: zone.time });
    this.sendPort(s);
    this.sendGuild(s);
    this.gradeTimer = Math.min(this.gradeTimer, 1); // calcule le rang du nouvel arrivant
    s.notify(`Bienvenue à ${zone.def.ports.find((p) => p.id === s.port)?.name ?? 'bord'}, capitaine ${s.name}.`, 'info');
    this.system(`${s.name} a pris la mer.`, zone);
  }

  private detach(s: Session) {
    if (this.stopped || this.sessions.get(s.accountId) !== s) return;
    const z = this.zones.get(s.zoneId);
    z?.removePlayer(s);
    this.leaveGroup(s);
    this.save(s);
    this.sessions.delete(s.accountId);
    this.byName.delete(lc(s.name));
  }

  private sendPort(s: Session) {
    if (!s.docked || !s.port) return;
    const z = this.zones.get(s.zoneId)!;
    s.offers = missionOffers(z.def, z.world, s.port, Date.now(), s.profile);
    s.send({ t: 'port', port: s.port, offers: s.offers, prices: portPrices(z.def, s.port, Date.now() / 1000, s.profile.skills.commerce) });
  }

  // ------------------------------------------------------------------ messages
  private handle(s: Session, m: C2S) {
    if (m.t === 'ping') { s.send({ t: 'pong', c: num(m.c, 0, 1e15), st: this.zones.get(s.zoneId)!.time }); return; }
    if (!s.created) {
      if (m.t === 'create') {
        const ship = typeof m.ship === 'string' ? m.ship : 'bayonnaise';
        createCharacter(s.profile, num(m.portrait, 0, 7), m.flag, ship);
        s.created = true;
        this.save(s);
        this.enter(s);
      }
      return;
    }
    const zone = this.zones.get(s.zoneId)!;
    const ship = zone.ships.get(s.entityId);
    const err = (text: string | null) => { if (text) s.send({ t: 'err', text }); };

    switch (m.t) {
      case 'input':
        // Reprise en main au clavier : le pilote automatique se coupe (l'attaque continue de tirer).
        s.input = { sail: Math.round(num(m.sail, 0, 3)), rudder: num(m.rudder, -1, 1) };
        s.seq = Math.floor(num(m.seq, 0, 1e9));
        s.nav = null;
        if (s.attacking) s.attacking = false;
        break;
      case 'fish': {
        if (!ship || s.docked) return err('Il faut être en mer pour pêcher.');
        if (m.on && zone.inSafeZone(ship.k.x, ship.k.z)) return err('Pas de pêche dans les eaux du port : éloignez-vous un peu.');
        s.fishing = !!m.on;
        s.fishTimer = 0;
        if (s.fishing) { s.nav = null; s.attacking = false; s.notify('Lignes à l\'eau ! Restez immobile pour pêcher.', 'info'); }
        break;
      }
      case 'daily':
        if (m.a === 'start') err(dailyStart(s, m.id, zone.def.tier));
        else dailyAbandon(s, m.id);
        break;
      case 'move': {
        const half = zone.def.half;
        s.nav = { x: num(m.x, -half, half), z: num(m.z, -half, half) };
        s.fishing = false;
        break;
      }
      case 'target': {
        const id = Math.floor(num(m.id, 0, 1e12));
        const t = zone.ships.get(id) ?? zone.forts.get(id);
        if (!id || !t) { s.targetId = 0; s.attacking = false; break; }
        s.targetId = id;
        s.attacking = !!m.attack && !!ship && zone.canHarm(ship, t);
        if (m.attack && !s.attacking) err('Cette cible ne peut pas être attaquée.');
        if (s.attacking) s.nav = null;
        break;
      }
      case 'fire':
        if (!ship || ship.sinking >= 0) return;
        zone.fire(ship, num(m.x, -1e5, 1e5), num(m.z, -1e5, 1e5));
        break;
      case 'ammo':
        if (ship && AMMO[m.id] && (m.id === 'rond' || s.profile.ammo[m.id] > 0)) ship.ammo = m.id;
        else if (ship) err(`Plus de ${AMMO[m.id]?.name.toLowerCase() ?? 'munitions'} à bord.`);
        break;
      case 'use':
        if (ship && CONSUMABLES[m.id]) err(zone.useItem(ship, m.id));
        break;
      case 'skill':
        if (ship && ACTIVE_SKILL_BY_ID[m.id]) err(zone.useSkill(ship, m.id));
        break;
      case 'dock':
        err(zone.dock(s));
        if (s.docked) this.sendPort(s);
        break;
      case 'undock':
        if (s.docked) err(zone.undock(s));
        break;
      case 'pvp': {
        if (zone.def.pvp === 'libre') { err('Cette zone est en guerre ouverte : le combat entre joueurs est permanent.'); return; }
        if (ship && zone.time - ship.lastHit < 15) { err('Impossible de changer de pavillon en plein combat.'); return; }
        s.pvp = !!m.on;
        s.notify(s.pvp ? 'Pavillon de combat hissé : les autres capitaines au pavillon rouge peuvent vous attaquer.' : 'Pavillon de combat amené.', 'warn');
        break;
      }
      case 'shop': {
        const before = activeShip(s.profile).uid;
        const r = shop(s, zone.def, m, Date.now() / 1000);
        err(r);
        if (!r && (m.a === 'upgrade' || m.a === 'skill' || before !== activeShip(s.profile).uid)) zone.refreshShip(s);
        break;
      }
      case 'mission':
        if (m.a === 'accept') err(acceptMission(s, s.offers, String(m.id)));
        else { s.profile.missions = s.profile.missions.filter((x) => x.id !== m.id); s.touch(); }
        break;
      case 'travel': {
        const def = ZONE_BY_ID[String(m.zone)];
        if (!def) return err('Carte inconnue.');
        if (def.id === s.zoneId) return;
        if (def.bonus) {
          const lvl = playerLevel(s.profile);
          if (!isBonusDay()) return err('Les cartes bonus ne sont ouvertes que le dimanche.');
          if (lvl < def.bonus.minLevel) return err(`${def.name} : niveau ${def.bonus.minLevel} requis.`);
          if (def.bonus.maxLevel && lvl > def.bonus.maxLevel) return err(`${def.name} est réservée aux capitaines de niveau ${def.bonus.maxLevel} au plus.`);
          if (def.bonus.rank === 'debutant' && Date.now() - s.lastHardBonus < 15 * 60 * 1000) return err('Vous sortez d\'une carte bonus plus dure : patientez 15 minutes.');
          if (def.bonus.rank !== 'debutant') s.lastHardBonus = Date.now();
        } else if (def.tier > s.profile.tier) return err(`Carte ${def.code} verrouillée : accomplissez la mission de passage de l'étage ${s.profile.tier}.`);
        if (s.deadTimer > 0) return;
        if (ship && zone.time - ship.lastHit < 10) return err('Impossible de changer de carte en plein combat.');
        const atSea = !s.docked && !!ship;
        zone.removePlayer(s);
        s.nav = null; s.targetId = 0; s.attacking = false;
        const dest = this.zones.get(def.id)!;
        s.port = def.ports.find((p) => p.main)?.id ?? def.ports[0].id;
        s.profile.zone = def.id;
        s.profile.port = s.port;
        dest.addPlayer(s, true);
        if (atSea) dest.arriveAtSea(s);
        s.touch();
        s.send({ t: 'zone', zone: def.id, port: s.port, id: s.entityId });
        if (!atSea) this.sendPort(s);
        s.notify(`Carte ${def.code} — ${def.name} : vous arrivez devant ${def.ports.find((p) => p.id === s.port)!.name}.`, 'event');
        break;
      }
      case 'chat':
        this.chat(s, m.ch, m.text, m.to);
        break;
      case 'guild':
        this.guild(s, m);
        break;
      case 'group':
        this.group(s, m.a, m.name);
        break;
    }
  }

  /** Rang général : classement de tous les capitaines, grades attribués selon les places disponibles. */
  computeGrades() {
    const map = new Map<string, Profile>();
    for (const r of this.store.allProfiles()) if (r.p.created) map.set(lc(r.name), r.p);
    for (const s of this.sessions.values()) if (s.created) map.set(lc(s.name), s.profile);
    const list = [...map.entries()].map(([k, p]) => ({ k, pts: rankPoints(p) })).sort((a, b) => b.pts - a.pts);
    const grades = assignGrades(list.map((x) => x.pts));
    const counts = GRADES.map(() => 0);
    grades.forEach((g) => counts[g]++);
    list.forEach((x, i) => {
      const s = this.byName.get(x.k);
      if (!s) return;
      const g = grades[i];
      if (s.grade !== g) { s.grade = g; this.forgetEverywhere(s.entityId); }
      const above = list.findLast((_, j) => grades[j] === g - 1);
      const below = list.find((_, j) => grades[j] === g + 1);
      s.send({ t: 'grade', grade: g, points: x.pts, next: g > 0 && above ? above.pts : null, prev: below ? below.pts : null, counts, position: i + 1 });
    });
  }

  /** Envoie un joueur sur une autre carte, à quai dans le port principal. */
  private relocate(s: Session, zoneId: string, why: string) {
    const from = this.zones.get(s.zoneId);
    const def = ZONE_BY_ID[zoneId];
    if (!from || !def) return;
    from.removePlayer(s);
    s.nav = null; s.targetId = 0; s.attacking = false; s.fishing = false;
    s.port = def.ports.find((p) => p.main)?.id ?? def.ports[0].id;
    s.profile.zone = def.id;
    s.profile.port = s.port;
    this.zones.get(def.id)!.addPlayer(s, true);
    s.touch();
    s.send({ t: 'zone', zone: def.id, port: s.port, id: s.entityId });
    this.sendPort(s);
    s.notify(why, 'event');
  }

  /** Mission de passage : couler assez d'ennemis à son étage le plus haut pour débloquer le suivant. */
  private tierProgress(z: Zone, s: Session) {
    const p = s.profile;
    if (z.def.tier !== p.tier || p.tier >= MAX_TIER) return;
    p.tierKills++;
    const req = tierRequirement(p.tier);
    if (p.tierKills >= req.kills && playerLevel(p) >= req.level) {
      p.tier++;
      p.tierKills = 0;
      const next = ZONES.filter((x) => x.tier === p.tier).map((x) => x.code).join(' et ');
      s.notify(`Mission de passage accomplie ! Nouvelle(s) carte(s) débloquée(s) : ${next}.`, 'level');
      p.or += 1000 * p.tier;
      this.system(`${s.name} a débloqué la carte ${next}.`);
    } else if (p.tierKills === req.kills) {
      s.notify(`Mission de passage : il vous faut atteindre le niveau ${req.level} pour monter de carte.`, 'warn');
    }
    s.touch();
  }

  // ------------------------------------------------------------------ chat
  private chat(s: Session, ch: ChatChannel, text: string, to?: string) {
    text = clean(text, 200);
    if (!text) return;
    const now = performance.now();
    if (now - s.lastChat < 700) return s.send({ t: 'err', text: 'Doucement, moussaillon : un message à la fois.' });
    s.lastChat = now;
    const msg: S2C = { t: 'chat', ch, from: s.name, text, tag: s.guildTag };
    if (ch === 'monde') for (const o of this.sessions.values()) o.send(msg);
    else if (ch === 'zone') for (const o of this.sessions.values()) { if (o.zoneId === s.zoneId) o.send(msg); }
    else if (ch === 'guilde') {
      const g = this.guilds.of(s.name);
      if (!g) return s.send({ t: 'err', text: 'Vous n\'avez pas de guilde.' });
      for (const n of g.members) this.byName.get(lc(n))?.send(msg);
    } else if (ch === 'groupe') {
      const g = s.groupId ? this.groups.get(s.groupId) : null;
      if (!g) return s.send({ t: 'err', text: 'Vous n\'êtes dans aucun groupe.' });
      for (const n of g.members) this.byName.get(lc(n))?.send(msg);
    } else if (ch === 'prive') {
      const target = this.byName.get(lc(clean(to, 16)));
      if (!target) return s.send({ t: 'err', text: 'Ce capitaine n\'est pas en ligne.' });
      target.send(msg);
      if (target !== s) s.send({ ...msg, from: `→ ${target.name}` });
    }
  }

  private system(text: string, zone?: Zone) {
    for (const o of this.sessions.values()) if (!zone || o.zoneId === zone.def.id) o.send({ t: 'chat', ch: 'systeme', from: 'Amirauté', text });
  }
  private systemAll(text: string) { this.system(text); }

  // ------------------------------------------------------------------ guildes
  private guild(s: Session, m: Extract<C2S, { t: 'guild' }>) {
    const say = (t: string) => s.notify(t, 'info');
    const fail = (t: string | null) => { if (t) s.send({ t: 'err', text: t }); return !!t; };
    switch (m.a) {
      case 'create': {
        if (s.profile.or < GUILD_COST) return fail(`Fonder une guilde coûte ${GUILD_COST} or.`);
        const g = this.guilds.create(s.name, clean(m.name, 24), clean(m.tag, 4));
        if (typeof g === 'string') return fail(g);
        s.profile.or -= GUILD_COST;
        s.touch();
        say(`La guilde ${g.name} [${g.tag}] est fondée !`);
        break;
      }
      case 'invite': {
        const target = clean(m.name, 16);
        if (fail(this.guilds.invite(s.name, target))) return;
        say(`Invitation envoyée à ${target}.`);
        const t = this.byName.get(lc(target));
        if (t) { t.notify(`${s.name} vous invite dans la guilde ${this.guilds.of(s.name)!.name}. Ouvrez l'onglet Guilde pour accepter.`, 'event'); this.sendGuild(t); }
        break;
      }
      case 'accept': {
        const g = this.guilds.accept(s.name, m.name ? clean(m.name, 24) : undefined);
        if (typeof g === 'string') return fail(g);
        say(`Vous rejoignez ${g.name} [${g.tag}].`);
        break;
      }
      case 'leave': if (fail(this.guilds.leave(s.name))) return; say('Vous avez quitté votre guilde.'); break;
      case 'kick': if (fail(this.guilds.kick(s.name, clean(m.name, 16)))) return; break;
      case 'ally': case 'war': case 'peace':
        if (fail(this.guilds.diplomacy(s.name, clean(m.name, 24), m.a))) return;
        say(m.a === 'war' ? 'La guerre est déclarée !' : m.a === 'ally' ? 'Alliance scellée.' : 'La paix est signée.');
        break;
    }
    // Rafraîchit tous les membres concernés (blason affiché au-dessus des navires).
    for (const o of this.sessions.values()) {
      const tag = this.guilds.of(o.name)?.tag ?? null;
      if (tag !== o.guildTag) { o.guildTag = tag; this.forgetEverywhere(o.entityId); }
      this.sendGuild(o);
    }
  }

  /** Force le renvoi de la fiche d'une entité (nom, blason) à tous les joueurs. */
  private forgetEverywhere(id: number) {
    for (const o of this.sessions.values()) o.known.delete(id);
  }

  private sendGuild(s: Session) {
    const g = this.guilds.of(s.name);
    s.profile.guild = g?.id ?? null;
    let info: GuildInfo | null = null;
    if (g) {
      info = {
        id: g.id, name: g.name, tag: g.tag, leader: g.leader,
        members: g.members.map((n) => { const o = this.byName.get(lc(n)); return { name: n, online: !!o, level: o ? playerLevel(o.profile) : 0 }; }),
        allies: g.allies.map((id) => this.guilds.byId.get(id)?.name ?? '?'),
        wars: g.wars.map((id) => this.guilds.byId.get(id)?.name ?? '?'),
      };
    }
    s.send({ t: 'guild', info: info ?? (this.guilds.invitesFor(s.name).length ? { id: '', name: '', tag: '', leader: '', members: [], allies: [], wars: [], invites: this.guilds.invitesFor(s.name) } : null) });
  }

  // ------------------------------------------------------------------ groupes
  private group(s: Session, a: 'invite' | 'accept' | 'leave', name?: string) {
    if (a === 'invite') {
      const t = this.byName.get(lc(clean(name, 16)));
      if (!t || t === s) return s.send({ t: 'err', text: 'Capitaine introuvable ou hors ligne.' });
      if (t.groupId) return s.send({ t: 'err', text: `${t.name} est déjà dans un groupe.` });
      let g = s.groupId ? this.groups.get(s.groupId) : undefined;
      if (!g) {
        g = { id: crypto.randomBytes(4).toString('hex'), leader: s.name, members: new Set([s.name]) };
        this.groups.set(g.id, g);
        s.groupId = g.id;
      }
      if (g.members.size >= 5) return s.send({ t: 'err', text: 'Groupe complet (5 capitaines).' });
      this.groupInvites.set(lc(t.name), g.id);
      t.send({ t: 'group', members: [...(t.groupId ? this.groups.get(t.groupId)!.members : [])], leader: null, invite: s.name });
      s.notify(`Invitation de groupe envoyée à ${t.name}.`);
      this.refreshGroup(g);
    } else if (a === 'accept') {
      const gid = this.groupInvites.get(lc(s.name));
      const g = gid ? this.groups.get(gid) : undefined;
      if (!g) return s.send({ t: 'err', text: 'Aucune invitation de groupe.' });
      this.leaveGroup(s);
      this.groupInvites.delete(lc(s.name));
      g.members.add(s.name);
      s.groupId = g.id;
      this.refreshGroup(g);
    } else this.leaveGroup(s);
  }

  private leaveGroup(s: Session) {
    if (!s.groupId) return;
    const g = this.groups.get(s.groupId);
    s.groupId = null;
    s.send({ t: 'group', members: [], leader: null });
    if (!g) return;
    g.members.delete(s.name);
    if (g.members.size <= 1) {
      for (const n of g.members) { const o = this.byName.get(lc(n)); if (o) { o.groupId = null; o.send({ t: 'group', members: [], leader: null }); } }
      this.groups.delete(g.id);
    } else {
      if (g.leader === s.name) g.leader = [...g.members][0];
      this.refreshGroup(g);
    }
    this.forgetEverywhere(s.entityId);
  }

  private refreshGroup(g: Group) {
    for (const n of g.members) {
      const o = this.byName.get(lc(n));
      if (!o) continue;
      o.send({ t: 'group', members: [...g.members], leader: g.leader });
      this.forgetEverywhere(o.entityId);
    }
  }

  // ------------------------------------------------------------------ classement
  leaderboard(mode: 'general' | 'saison' = 'general'): LeaderEntry[] {
    const map = new Map<string, Profile>();
    for (const r of this.store.allProfiles()) if (r.p.created) map.set(lc(r.name), r.p);
    for (const s of this.sessions.values()) if (s.created) map.set(lc(s.name), s.profile);
    return [...map.values()]
      .map((p) => ({ name: p.name, level: levelFromXp(p.xp).level, xp: p.xp, kills: p.stats?.kills ?? 0, pvp: p.stats?.pvp ?? 0, reputation: p.reputation, tag: this.guilds.of(p.name)?.tag ?? null, ship: SHIP_BY_ID[activeShip(p)?.def ?? 'bayonnaise']?.name ?? '', season: seasonPoints(p.season) }))
      .filter((e) => mode === 'general' || e.season > 0)
      .sort((a, b) => (mode === 'saison' ? b.season - a.season || b.xp - a.xp : b.xp - a.xp))
      .slice(0, 50);
  }

  status() {
    return {
      version: PROTOCOL_VERSION,
      online: this.sessions.size,
      zones: [...this.zones.values()].map((z) => ({ id: z.def.id, players: z.links.size })),
    };
  }
}

