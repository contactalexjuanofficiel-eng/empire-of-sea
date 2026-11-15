import test from 'node:test';
import assert from 'node:assert/strict';
import { startGame } from './index.js';

test('serveur HTTP : client servi, redirection, pas de sortie de dossier', async () => {
  const g = await startGame({ port: 0, tickMs: 50, autosaveMs: 0 });
  const base = 'http://127.0.0.1:' + g.port;
  const r0 = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(r0.status, 302);
  assert.ok(r0.headers.get('location').includes('ws%3A%2F%2F127.0.0.1'));
  const r1 = await fetch(base + '/?ws=x');
  assert.equal(r1.status, 200);
  assert.ok((await r1.text()).includes('Empire des Mers'));
  const r2 = await fetch(base + '/..%2Fserver%2Findex.js');
  assert.equal(r2.status, 404);
  const r3 = await fetch(base + '/%2e%2e/package.json');
  assert.equal(r3.status, 404);
  g.stop();
});
