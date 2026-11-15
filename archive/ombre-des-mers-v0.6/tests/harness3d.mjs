// Harnais : exécute client3d/index.html dans un contexte vm avec DOM et THREE simulés (aucun rendu).
import vm from 'node:vm';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../client3d/index.html', import.meta.url), 'utf8');
const js = html.match(/<script>\n([\s\S]*)<\/script>/)[1];
const mk = () => { const f = function () {}; return new Proxy(f, {
  get: (t, k) => { if (k === Symbol.toPrimitive) return () => 0; if (k === 'length') return 0; if (k === 'then') return undefined;
    if (k === 'userData') return t.userData || (t.userData = {}); if (k === 'children') return []; if (k === 'style') return t._s || (t._s = {});
    if (k === 'firstChild' || k === 'lastChild') return mk(); return t[k] !== undefined ? t[k] : mk(); },
  set: (t, k, v) => { t[k] = v; return true; }, apply: () => mk(), construct: () => mk() }); };
const THREE = new Proxy({}, { get: (t, k) => k === 'Vector3' ? function () { return { project() { return { x: 0, y: 0, z: 0 }; } }; } : mk() });
const dom = () => ({ style: {}, appendChild() {}, removeChild() {}, remove() {}, children: [], firstChild: { style: {} }, lastChild: { firstChild: { style: {} } },
  addEventListener() {}, getContext: () => mk(), insertAdjacentHTML() {}, set textContent(v) { this._t = v; }, get textContent() { return this._t || ''; }, set innerHTML(v) {}, parentNode: null, value: '', blur() {}, focus() {} });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function makeClient(search) {
  const els = {}; let cb = null, now = 0;
  const ctx = { THREE, document: { getElementById: (i) => els[i] || (els[i] = dom()), createElement: () => dom(), body: dom() }, navigator: {},
    localStorage: { getItem() { return null; }, setItem() {} }, console, Math, performance: { now: () => now }, requestAnimationFrame: (f) => { cb = f; },
    addEventListener() {}, setTimeout: () => 0, devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, URLSearchParams, WebSocket, location: { search } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(js, ctx);
  return { E: ctx.__edm, els, async run(frames) { for (let i = 0; i < frames; i++) { await sleep(30); now += 30; const f = cb; cb = null; f(now); } } };
}
