// Comptes joueurs + persistance JSON (écriture atomique). Mots de passe : scrypt + sel aléatoire.
// Prototype : pour la production, passer à PostgreSQL/SQLite (voir docs/ROADMAP.md).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const NAME_RE = /^[\p{L}0-9_-]{3,16}$/u;
const key = (s) => String(s).toLowerCase();

export function createStore(file) {
  const users = new Map(); // clé minuscule -> { name, salt, hash, save }
  let guilds = [];
  if (file && fs.existsSync(file)) {
    try {
      const db = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const u of db.users || []) if (u && NAME_RE.test(u.name || '')) users.set(key(u.name), u);
      guilds = Array.isArray(db.guilds) ? db.guilds : [];
    } catch { /* fichier corrompu : on repart à vide, l'ancien reste sur disque */ }
  }
  let dirty = false;
  const api = {
    get guilds() { return guilds; },
    setGuilds(g) { guilds = g; dirty = true; },
    async register(name, pass) {
      if (!NAME_RE.test(name || '')) return { ok: false, msg: 'Pseudo invalide (3-16 lettres, chiffres, _ ou -)' };
      if (typeof pass !== 'string' || pass.length < 6 || pass.length > 100) return { ok: false, msg: 'Mot de passe : 6 caractères minimum' };
      if (users.has(key(name))) return { ok: false, msg: 'Ce pseudo est déjà pris' };
      const salt = crypto.randomBytes(16);
      const hash = await scrypt(pass, salt, 32);
      if (users.has(key(name))) return { ok: false, msg: 'Ce pseudo est déjà pris' };
      users.set(key(name), { name, salt: salt.toString('hex'), hash: hash.toString('hex'), save: null });
      dirty = true;
      return { ok: true, name };
    },
    async login(name, pass) {
      const u = users.get(key(name || ''));
      const salt = u ? Buffer.from(u.salt, 'hex') : Buffer.alloc(16);
      const hash = await scrypt(String(pass || ''), salt, 32); // même coût si le compte n'existe pas
      if (!u || !crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) return { ok: false, msg: 'Pseudo ou mot de passe incorrect' };
      return { ok: true, name: u.name, save: u.save };
    },
    saveProgress(name, data) { const u = users.get(key(name)); if (u) { u.save = data; dirty = true; } },
    flush() {
      if (!file || !dirty) return;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ users: [...users.values()], guilds }));
      fs.renameSync(tmp, file);
      dirty = false;
    },
  };
  return api;
}
