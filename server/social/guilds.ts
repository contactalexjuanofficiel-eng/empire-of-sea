// Guildes, alliances et guerres. Persistées dans la base ; les invitations restent en mémoire.
import crypto from 'node:crypto';
import type { GuildRow, Store } from '../db.ts';

export const GUILD_COST = 5000;
const NAME_RE = /^[\p{L}0-9 '_-]{3,24}$/u;
const TAG_RE = /^[A-Za-z0-9]{2,4}$/;
const lc = (s: string) => s.toLowerCase();

export class Guilds {
  readonly byId = new Map<string, GuildRow>();
  private invites = new Map<string, Set<string>>(); // joueur (minuscule) -> ids de guilde

  constructor(private store: Store) {
    for (const g of store.loadGuilds()) this.byId.set(g.id, g);
  }

  of(name: string): GuildRow | null {
    const n = lc(name);
    for (const g of this.byId.values()) if (g.members.some((m) => lc(m) === n)) return g;
    return null;
  }
  byTag(tag: string) {
    for (const g of this.byId.values()) if (lc(g.tag) === lc(tag) || lc(g.name) === lc(tag)) return g;
    return null;
  }
  invitesFor(name: string) {
    return [...(this.invites.get(lc(name)) ?? [])].map((id) => this.byId.get(id)?.name).filter(Boolean) as string[];
  }

  create(leader: string, name: string, tag: string): GuildRow | string {
    name = String(name ?? '').trim();
    tag = String(tag ?? '').trim().toUpperCase();
    if (!NAME_RE.test(name)) return 'Nom de guilde invalide (3 à 24 caractères).';
    if (!TAG_RE.test(tag)) return 'Blason invalide : 2 à 4 lettres ou chiffres.';
    if (this.of(leader)) return 'Vous faites déjà partie d\'une guilde.';
    for (const g of this.byId.values()) if (lc(g.name) === lc(name) || lc(g.tag) === lc(tag)) return 'Ce nom ou ce blason est déjà pris.';
    const g: GuildRow = { id: crypto.randomBytes(5).toString('hex'), name, tag, leader, members: [leader], allies: [], wars: [] };
    this.byId.set(g.id, g);
    this.store.saveGuild(g);
    return g;
  }

  invite(by: string, target: string): string | null {
    const g = this.of(by);
    if (!g) return 'Vous n\'avez pas de guilde.';
    if (lc(g.leader) !== lc(by)) return 'Seul le chef de guilde peut inviter.';
    if (this.of(target)) return `${target} fait déjà partie d'une guilde.`;
    if (g.members.length >= 50) return 'Guilde complète (50 membres).';
    const set = this.invites.get(lc(target)) ?? new Set();
    set.add(g.id);
    this.invites.set(lc(target), set);
    return null;
  }

  accept(name: string, guildName?: string): GuildRow | string {
    const set = this.invites.get(lc(name));
    if (!set || !set.size) return 'Aucune invitation en attente.';
    let g: GuildRow | undefined;
    for (const id of set) {
      const c = this.byId.get(id);
      if (c && (!guildName || lc(c.name) === lc(guildName) || lc(c.tag) === lc(guildName))) { g = c; break; }
    }
    if (!g) return 'Invitation introuvable.';
    if (this.of(name)) return 'Quittez d\'abord votre guilde actuelle.';
    g.members.push(name);
    this.invites.delete(lc(name));
    this.store.saveGuild(g);
    return g;
  }

  leave(name: string): string | null {
    const g = this.of(name);
    if (!g) return 'Vous n\'avez pas de guilde.';
    g.members = g.members.filter((m) => lc(m) !== lc(name));
    if (!g.members.length) {
      this.byId.delete(g.id);
      this.store.deleteGuild(g.id);
      for (const o of this.byId.values()) {
        o.allies = o.allies.filter((x) => x !== g.id);
        o.wars = o.wars.filter((x) => x !== g.id);
        this.store.saveGuild(o);
      }
      return null;
    }
    if (lc(g.leader) === lc(name)) g.leader = g.members[0];
    this.store.saveGuild(g);
    return null;
  }

  kick(by: string, target: string): string | null {
    const g = this.of(by);
    if (!g || lc(g.leader) !== lc(by)) return 'Réservé au chef de guilde.';
    if (!g.members.some((m) => lc(m) === lc(target)) || lc(target) === lc(by)) return 'Membre introuvable.';
    g.members = g.members.filter((m) => lc(m) !== lc(target));
    this.store.saveGuild(g);
    return null;
  }

  diplomacy(by: string, other: string, kind: 'ally' | 'war' | 'peace'): string | null {
    const g = this.of(by);
    if (!g || lc(g.leader) !== lc(by)) return 'Réservé au chef de guilde.';
    const o = this.byTag(other);
    if (!o || o.id === g.id) return 'Guilde introuvable.';
    g.allies = g.allies.filter((x) => x !== o.id);
    g.wars = g.wars.filter((x) => x !== o.id);
    o.allies = o.allies.filter((x) => x !== g.id);
    o.wars = o.wars.filter((x) => x !== g.id);
    if (kind === 'ally') { g.allies.push(o.id); o.allies.push(g.id); }
    if (kind === 'war') { g.wars.push(o.id); o.wars.push(g.id); }
    this.store.saveGuild(g);
    this.store.saveGuild(o);
    return null;
  }

  relation(a: string, b: string): 'friend' | 'neutral' | 'war' {
    const ga = this.of(a), gb = this.of(b);
    if (!ga || !gb) return 'neutral';
    if (ga.id === gb.id || ga.allies.includes(gb.id)) return 'friend';
    if (ga.wars.includes(gb.id)) return 'war';
    return 'neutral';
  }
}
