// Guildes, alliances et guerres — logique pure sur `w.guilds` (Map clé minuscule -> guilde).
// Les commandes viennent du chat : /guilde creer|inviter|accepter|quitter|expulser|alliance|guerre|paix|info

export const GUILD_COST = 1000;
const NAME_RE = /^[\p{L}0-9_-]{3,20}$/u;
const TAG_RE = /^[A-Za-z0-9]{2,4}$/;
const key = (s) => String(s).toLowerCase();

const guildOf = (w, p) => (p && p.guild ? w.guilds.get(key(p.guild)) || null : null);

export function friendly(w, a, b) {
  const ga = guildOf(w, a), gb = guildOf(w, b);
  if (!ga || !gb) return false;
  return ga === gb || ga.allies.has(key(gb.name));
}
export function atWar(w, a, b) {
  const ga = guildOf(w, a), gb = guildOf(w, b);
  return !!(ga && gb && ga.wars.has(key(gb.name)));
}
export const tagOf = (w, p) => { const g = guildOf(w, p); return g ? g.tag : null; };

export function serializeGuilds(w) {
  return [...w.guilds.values()].map((g) => ({ name: g.name, tag: g.tag, leader: g.leader, members: [...g.members], allies: [...g.allies], wars: [...g.wars] }));
}
export function loadGuilds(w, list) {
  w.guilds = new Map();
  if (!Array.isArray(list)) return;
  for (const g of list) {
    if (!g || !NAME_RE.test(g.name || '') || !TAG_RE.test(g.tag || '') || !Array.isArray(g.members) || !g.members.length) continue;
    w.guilds.set(key(g.name), { name: g.name, tag: g.tag, leader: g.leader, members: new Set(g.members.map(String)), allies: new Set((g.allies || []).map(String)), wars: new Set((g.wars || []).map(String)) });
  }
}
// À la connexion : la guilde sauvegardée doit exister et compter le joueur.
export function validMembership(w, name, guildName) {
  const g = guildName ? w.guilds.get(key(guildName)) : null;
  return g && g.members.has(name) ? g.name : null;
}

function dissolve(w, g) {
  const k = key(g.name);
  w.guilds.delete(k);
  for (const o of w.guilds.values()) { o.allies.delete(k); o.wars.delete(k); }
  for (const p of w.players.values()) if (p.guild && key(p.guild) === k) p.guild = null;
}
function leave(w, g, name) {
  g.members.delete(name);
  for (const p of w.players.values()) if (p.name === name) p.guild = null;
  if (!g.members.size) return dissolve(w, g);
  if (g.leader === name) g.leader = [...g.members][0];
}
export const leaveOnDisconnect = () => {}; // l'appartenance reste : elle est sauvegardée avec le compte.

// say(nomJoueur, texte) envoie un message système ; online(nom) -> joueur connecté ou null.
export function guildCommand(w, p, args, { say, online }) {
  const [cmd, a1, a2] = args;
  const g = guildOf(w, p);
  const me = (t) => say(p.name, t);
  const needLeader = () => { if (!g) { me('Vous n\'avez pas de guilde.'); return false; } if (g.leader !== p.name) { me('Réservé au chef de guilde.'); return false; } return true; };
  const other = () => (a1 ? w.guilds.get(key(a1)) : null);
  w.invites = w.invites || new Map(); w.proposals = w.proposals || new Set();
  switch (cmd) {
    case 'creer': {
      if (g) return me('Quittez d\'abord votre guilde.');
      if (!NAME_RE.test(a1 || '') || !TAG_RE.test(a2 || '')) return me('Usage : /guilde creer NOM TAG (nom 3-20 caractères sans espace, tag 2-4 lettres/chiffres)');
      if (w.guilds.has(key(a1))) return me('Ce nom de guilde existe déjà.');
      if ([...w.guilds.values()].some((x) => x.tag.toLowerCase() === a2.toLowerCase())) return me('Ce tag est déjà pris.');
      if (p.gold < GUILD_COST) return me('Il faut ' + GUILD_COST + ' or pour fonder une guilde.');
      p.gold -= GUILD_COST;
      w.guilds.set(key(a1), { name: a1, tag: a2.toUpperCase(), leader: p.name, members: new Set([p.name]), allies: new Set(), wars: new Set() });
      p.guild = a1;
      return me('Guilde « ' + a1 + ' » [' + a2.toUpperCase() + '] fondée !');
    }
    case 'inviter': {
      if (!needLeader()) return;
      const t = a1 && online(a1);
      if (!t) return me('Joueur introuvable ou hors ligne.');
      if (t.guild) return me(t.name + ' est déjà dans une guilde.');
      w.invites.set(t.name, key(g.name));
      say(t.name, p.name + ' vous invite dans la guilde « ' + g.name + ' ». Tapez /guilde accepter');
      return me('Invitation envoyée à ' + t.name + '.');
    }
    case 'accepter': {
      const k = w.invites.get(p.name), ng = k && w.guilds.get(k);
      if (g) return me('Quittez d\'abord votre guilde.');
      if (!ng) return me('Aucune invitation en attente.');
      w.invites.delete(p.name); ng.members.add(p.name); p.guild = ng.name;
      for (const m of ng.members) say(m, p.name + ' a rejoint la guilde !');
      return;
    }
    case 'quitter': { if (!g) return me('Vous n\'avez pas de guilde.'); leave(w, g, p.name); return me('Vous avez quitté la guilde.'); }
    case 'expulser': {
      if (!needLeader()) return;
      if (!a1 || a1 === p.name || !g.members.has(a1)) return me('Membre introuvable.');
      leave(w, g, a1); say(a1, 'Vous avez été expulsé de la guilde.'); return me(a1 + ' expulsé.');
    }
    case 'alliance': case 'paix': {
      if (!needLeader()) return;
      const o = other();
      if (!o || o === g) return me('Guilde introuvable.');
      if (cmd === 'alliance' && g.wars.has(key(o.name))) return me('Faites d\'abord la paix.');
      const mine = cmd + ':' + key(g.name) + '>' + key(o.name), theirs = cmd + ':' + key(o.name) + '>' + key(g.name);
      if (w.proposals.has(theirs)) {
        w.proposals.delete(theirs);
        if (cmd === 'alliance') { g.allies.add(key(o.name)); o.allies.add(key(g.name)); } else { g.wars.delete(key(o.name)); o.wars.delete(key(g.name)); }
        for (const m of [...g.members, ...o.members]) say(m, cmd === 'alliance' ? 'Alliance conclue entre ' + g.name + ' et ' + o.name + ' !' : 'La paix est signée entre ' + g.name + ' et ' + o.name + '.');
        return;
      }
      w.proposals.add(mine);
      say(o.leader, 'La guilde ' + g.name + ' propose ' + (cmd === 'alliance' ? 'une alliance' : 'la paix') + '. Répondez : /guilde ' + cmd + ' ' + g.name);
      return me('Proposition envoyée à ' + o.name + '.');
    }
    case 'guerre': {
      if (!needLeader()) return;
      const o = other();
      if (!o || o === g) return me('Guilde introuvable.');
      g.allies.delete(key(o.name)); o.allies.delete(key(g.name));
      g.wars.add(key(o.name)); o.wars.add(key(g.name));
      for (const m of [...g.members, ...o.members]) say(m, '⚔ ' + g.name + ' déclare la guerre à ' + o.name + ' ! Les primes sont doublées.');
      return;
    }
    case 'info': {
      if (!g) return me('Vous n\'avez pas de guilde. /guilde creer NOM TAG (' + GUILD_COST + ' or)');
      return me('« ' + g.name + ' » [' + g.tag + '] chef : ' + g.leader + ' · membres : ' + [...g.members].join(', ') + ' · alliés : ' + ([...g.allies].join(', ') || 'aucun') + ' · guerres : ' + ([...g.wars].join(', ') || 'aucune'));
    }
    default:
      return me('Commandes : /guilde creer NOM TAG · inviter PSEUDO · accepter · quitter · expulser PSEUDO · alliance GUILDE · guerre GUILDE · paix GUILDE · info');
  }
}
