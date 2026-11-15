// Test de bout en bout dans un vrai navigateur (Chromium + WebGL logiciel) :
// deux capitaines se connectent au même serveur, créent leur personnage, prennent la mer, se voient et tirent.
// Prérequis : serveur lancé (npm start). Usage : node tests/e2e.mjs [url] [dossier-captures]
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Playwright installé localement (npm i -D playwright) ou globalement (NODE_PATH).
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const URL = process.argv[2] ?? 'http://localhost:8080';
const OUT = process.argv[3] ?? 'tests/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function player(name, shipIdx, light = false) {
  const ctx = await browser.newContext({ viewport: light ? { width: 960, height: 600 } : { width: 1440, height: 860 }, deviceScaleFactor: 1 });
  // Le second navigateur tourne en qualité basse : le rendu WebGL logiciel des tests est lent.
  if (light) await ctx.addInitScript(() => localStorage.setItem('edm.settings', JSON.stringify({ quality: 'basse' })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name} console: ${m.text()}`); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.login-card', { timeout: 180000 });
  return { page, ctx, name, shipIdx };
}

async function register(p) {
  await p.page.click('text=Nouveau capitaine');
  await p.page.fill('input[autocomplete=username]', p.name);
  await p.page.fill('input[type=password]', 'motdepasse1');
  await p.page.click('button.btn-gold');
  await p.page.waitForSelector('.create-panel', { timeout: 180000 });
  await p.page.click('text=Continuer');
  await p.page.locator('.starter').nth(p.shipIdx).click();
  await p.page.click('text=Appareiller avec');
  await p.page.waitForSelector('.port', { timeout: 180000 });
}

const A = await player(`Capitaine${Date.now() % 10000}`, 0);
await sleep(4000);
await A.page.screenshot({ path: `${OUT}/01-ecran-titre.png` });
await register(A);
await sleep(2500);
await A.page.screenshot({ path: `${OUT}/02-port.png` });
await A.page.click('text=Chantier naval');
await sleep(1500);
await A.page.screenshot({ path: `${OUT}/03-chantier.png` });

const B = await player(`Corsaire${Date.now() % 10000}`, 1, true);
await register(B);

for (const p of [A, B]) {
  await p.page.click('text=Prendre la mer');
}
await sleep(3000);
// A avance à pleine voile et tourne un peu
await A.page.keyboard.press('KeyW');
await A.page.keyboard.press('KeyW');
await A.page.keyboard.down('KeyD');
await sleep(1500);
await A.page.keyboard.up('KeyD');
await sleep(3000);
await A.page.screenshot({ path: `${OUT}/04-en-mer.png` });
// Visée à bâbord et tir
const vp = A.page.viewportSize();
await A.page.mouse.move(vp.width * 0.2, vp.height * 0.62);
await sleep(400);
await A.page.mouse.click(vp.width * 0.2, vp.height * 0.62);
await A.page.keyboard.press('Space');
await sleep(900);
await A.page.screenshot({ path: `${OUT}/05-bordee.png` });
await sleep(1600);
await A.page.screenshot({ path: `${OUT}/06-fumee.png` });

const seen = await A.page.evaluate(() => [...document.querySelectorAll('.elabel')].map((e) => e.textContent).filter(Boolean));
const status = await (await fetch(`${URL}/api/status`)).json();
console.log('Étiquettes visibles chez A :', seen.slice(0, 12));
console.log('Statut serveur :', JSON.stringify(status));
const bSeesA = await B.page.evaluate((n) => [...document.querySelectorAll('.elabel')].some((e) => e.textContent?.includes(n)), A.name);
console.log(`B voit A : ${bSeesA}`);
await B.page.screenshot({ path: `${OUT}/07-joueur-b.png` });
console.log(errors.length ? `ERREURS :\n${errors.join('\n')}` : 'Aucune erreur JavaScript.');
await browser.close();
process.exit(errors.length || !bSeesA ? 1 : 0);
