import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { proxyBackend, isBackendRoute } from '../server/backend.mjs';
const id = '00000000-0000-4000-8000-000000000001';
async function listen(server, t) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('proxy only exposes user routes, excluding internal processing and arbitrary URLs', () => {
  assert.ok(isBackendRoute('/api/jobs', 'POST'));
  assert.ok(isBackendRoute(`/api/jobs/${id}/events`, 'GET'));
  assert.equal(isBackendRoute('/internal/maintenance', 'POST'), false);
  assert.equal(isBackendRoute('/api/jobs', 'DELETE'), false);
  assert.equal(isBackendRoute('//example.com', 'GET'), false);
});

test('proxy rejects unauthenticated calls before contacting the backend', async t => {
  const base = await listen(createServer((req, res) => proxyBackend(req, res, 'http://127.0.0.1:1')), t);
  const response = await fetch(`${base}/api/jobs`, { method: 'POST' });
  assert.equal(response.status, 401);
});

test('proxy preserves auth, idempotency and multipart bytes', async t => {
  const upstream = await listen(createServer(async (req, res) => {
    assert.equal(req.headers.authorization, 'Bearer test-token');
    assert.equal(req.headers['idempotency-key'], 'unique-key');
    let body = '';
    for await (const chunk of req) body += chunk;
    assert.match(body, /example.pdf/);
    res.writeHead(202, { 'Content-Type': 'application/json' }).end(JSON.stringify({ id }));
  }), t);
  const proxy = await listen(createServer((req, res) => proxyBackend(req, res, upstream)), t);
  const body = new FormData(); body.append('file', new File(['%PDF-1.4'], 'example.pdf'));
  const response = await fetch(`${proxy}/api/jobs`, { method: 'POST', body, headers: { Authorization: 'Bearer test-token', 'Idempotency-Key': 'unique-key' } });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).id, id);
});

test('stream window ends the connection without cancelling its durable backend job', async t => {
  const upstream = await listen(createServer((req, res) => {
    assert.equal(req.method, 'GET');
    assert.equal(req.headers['last-event-id'], '7');
    res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write(': heartbeat\n\n');
  }), t);
  const proxy = await listen(createServer((req, res) => proxyBackend(req, res, upstream, { streamWindowMs: 30 })), t);
  const response = await fetch(`${proxy}/api/jobs/${id}/events`, { headers: { Authorization: 'Bearer test-token', 'Last-Event-ID': '7' } });
  assert.equal(await response.text(), ': heartbeat\n\n');
});
