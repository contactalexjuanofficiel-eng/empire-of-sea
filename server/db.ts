// Persistance : SQLite intégré à Node (node:sqlite), aucune installation requise.
// L'interface `Store` isole le reste du serveur de la base : on pourra la remplacer par PostgreSQL / Supabase
// sans toucher à la simulation.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Profile } from '../shared/protocol.ts';

export interface AccountRow { id: number; name: string; salt: string; hash: string }
export interface GuildRow { id: string; name: string; tag: string; leader: string; members: string[]; allies: string[]; wars: string[] }

export interface Store {
  findAccount(name: string): AccountRow | undefined;
  createAccount(name: string, salt: string, hash: string): number;
  loadProfile(accountId: number): Profile | null;
  saveProfile(accountId: number, p: Profile): void;
  createSession(token: string, accountId: number, expires: number): void;
  sessionAccount(token: string): number | null;
  accountName(id: number): string | null;
  allProfiles(): { name: string; p: Profile }[];
  loadGuilds(): GuildRow[];
  saveGuild(g: GuildRow): void;
  deleteGuild(id: string): void;
  close(): void;
}

export function openStore(file: string): Store {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      account_id INTEGER PRIMARY KEY REFERENCES accounts(id),
      data TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS profiles_xp ON profiles(xp DESC);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guilds (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
  const q = {
    findAccount: db.prepare('SELECT id, name, salt, hash FROM accounts WHERE name = ?'),
    createAccount: db.prepare('INSERT INTO accounts (name, salt, hash, created) VALUES (?, ?, ?, ?)'),
    accountName: db.prepare('SELECT name FROM accounts WHERE id = ?'),
    loadProfile: db.prepare('SELECT data FROM profiles WHERE account_id = ?'),
    saveProfile: db.prepare(`INSERT INTO profiles (account_id, data, xp, updated) VALUES (?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET data = excluded.data, xp = excluded.xp, updated = excluded.updated`),
    createSession: db.prepare('INSERT OR REPLACE INTO sessions (token, account_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT account_id FROM sessions WHERE token = ? AND expires > ?'),
    purge: db.prepare('DELETE FROM sessions WHERE expires <= ?'),
    allProfiles: db.prepare('SELECT a.name AS name, p.data AS data FROM profiles p JOIN accounts a ON a.id = p.account_id ORDER BY p.xp DESC LIMIT 200'),
    loadGuilds: db.prepare('SELECT data FROM guilds'),
    saveGuild: db.prepare('INSERT INTO guilds (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data'),
    deleteGuild: db.prepare('DELETE FROM guilds WHERE id = ?'),
  };
  q.purge.run(Date.now());
  return {
    findAccount: (name) => q.findAccount.get(name) as AccountRow | undefined,
    createAccount: (name, salt, hash) => Number(q.createAccount.run(name, salt, hash, Date.now()).lastInsertRowid),
    loadProfile: (id) => {
      const r = q.loadProfile.get(id) as { data: string } | undefined;
      if (!r) return null;
      try { return JSON.parse(r.data) as Profile; } catch { return null; }
    },
    saveProfile: (id, p) => { q.saveProfile.run(id, JSON.stringify(p), Math.floor(p.xp), Date.now()); },
    createSession: (token, id, expires) => { q.createSession.run(token, id, expires); },
    sessionAccount: (token) => {
      const r = q.session.get(token, Date.now()) as { account_id: number } | undefined;
      return r ? r.account_id : null;
    },
    accountName: (id) => (q.accountName.get(id) as { name: string } | undefined)?.name ?? null,
    allProfiles: () => (q.allProfiles.all() as { name: string; data: string }[]).flatMap((r) => {
      try { return [{ name: r.name, p: JSON.parse(r.data) as Profile }]; } catch { return []; }
    }),
    loadGuilds: () => (q.loadGuilds.all() as { data: string }[]).flatMap((r) => {
      try { return [JSON.parse(r.data) as GuildRow]; } catch { return []; }
    }),
    saveGuild: (g) => { q.saveGuild.run(g.id, JSON.stringify(g)); },
    deleteGuild: (id) => { q.deleteGuild.run(id); },
    close: () => db.close(),
  };
}
