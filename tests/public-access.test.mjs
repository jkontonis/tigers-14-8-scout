import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('api/data.js', 'utf8');
const storeImport = "import { ready, getText } from '../lib/store.js';";
assert.ok(source.includes(storeImport), 'Update the test when the storage dependency changes');
async function handlerFor(text = '{"fixture":[]}', storageReady = true) {
  const stub = `const ready = () => ${storageReady}; const getText = async () => ${JSON.stringify(text)};`;
  return (await import('data:text/javascript;base64,' + Buffer.from(source.replace(storeImport, stub)).toString('base64'))).default;
}
function response() {
  return { headers: {}, code: null, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    end() { return this; }
  };
}
test('new visitors can view without a stored password', () => {
  const CONFIG = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  assert.ok(!CONFIG.passcode);
  const html = fs.readFileSync('index.html', 'utf8');
  const start = html.indexOf('function gate() {');
  const end = html.indexOf('(async () => {', start);
  assert.ok(start >= 0 && end > start);
  const context = { CONFIG, localStorage: { getItem: () => null }, $: () => { throw new Error('Login UI must not be opened'); } };
  assert.equal(vm.runInNewContext(html.slice(start, end) + '\ngate();', context), true);
});
test('public GET serves data without headers or a key', async () => {
  const res = response(); await (await handlerFor())({ method: 'GET' }, res);
  assert.equal(res.code, 200); assert.equal(res.body, '{"fixture":[]}');
  assert.equal(res.headers['cache-control'], 'no-store');
});
test('public HEAD has no response body', async () => {
  const res = response(); await (await handlerFor())({ method: 'HEAD' }, res);
  assert.equal(res.code, 200); assert.equal(res.body, null);
});
test('public data endpoint rejects writes', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const res = response(); await (await handlerFor())({ method }, res);
    assert.equal(res.code, 405); assert.equal(res.headers.allow, 'GET, HEAD');
  }
});
test('unpublished data remains an explicit 404', async () => {
  const res = response(); await (await handlerFor(null))({ method: 'GET' }, res);
  assert.equal(res.code, 404);
});
test('publishing still requires a verified workflow', () => {
  const publish = fs.readFileSync('api/publish.js', 'utf8');
  assert.match(publish, /if\(!\(await verifyRunner\(req\)\)\)return res\.status\(403\)/);
});
