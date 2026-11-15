// Comptes : mots de passe hachés avec scrypt + sel aléatoire, jetons de session opaques.
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { Store } from './db.ts';

const scrypt = promisify(crypto.scrypt) as (p: string, s: Buffer, n: number) => Promise<Buffer>;
export const NAME_RE = /^[\p{L}0-9_-]{3,16}$/u;
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;

export type AuthResult = { ok: true; token: string; name: string } | { ok: false; msg: string };

export async function register(store: Store, name: string, pass: string): Promise<AuthResult> {
  name = String(name ?? '').trim();
  if (!NAME_RE.test(name)) return { ok: false, msg: 'Nom de capitaine invalide : 3 à 16 lettres, chiffres, _ ou -.' };
  if (typeof pass !== 'string' || pass.length < 6 || pass.length > 128) return { ok: false, msg: 'Le mot de passe doit contenir au moins 6 caractères.' };
  if (store.findAccount(name)) return { ok: false, msg: 'Ce nom de capitaine est déjà pris.' };
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pass, salt, 32);
  if (store.findAccount(name)) return { ok: false, msg: 'Ce nom de capitaine est déjà pris.' };
  const id = store.createAccount(name, salt.toString('hex'), hash.toString('hex'));
  return { ok: true, token: newSession(store, id), name };
}

export async function login(store: Store, name: string, pass: string): Promise<AuthResult> {
  const acc = store.findAccount(String(name ?? '').trim());
  const salt = acc ? Buffer.from(acc.salt, 'hex') : Buffer.alloc(16);
  const hash = await scrypt(String(pass ?? ''), salt, 32); // même coût si le compte n'existe pas
  if (!acc || !crypto.timingSafeEqual(hash, Buffer.from(acc.hash, 'hex'))) return { ok: false, msg: 'Nom de capitaine ou mot de passe incorrect.' };
  return { ok: true, token: newSession(store, acc.id), name: acc.name };
}

function newSession(store: Store, accountId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  store.createSession(token, accountId, Date.now() + SESSION_MS);
  return token;
}
