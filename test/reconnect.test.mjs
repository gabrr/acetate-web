import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { classify } from '../server/proxy.mjs';
import { reconnect } from '../server/runs.mjs';

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

test('disconnect preserves the upstream run and reconnect replays only missed events', async t => {
  let calls = 0;
  let complete;
  const gate = new Promise(resolve => { complete = resolve; });
  const upstream = createServer(async (request, response) => {
    calls++;
    for await (const chunk of request) { /* consume the upload */ }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    response.write(event('step_started', { step_id: 'read', name: 'Read document' }));
    await gate;
    response.end(event('result', { transactions: [] }));
  });
  const endpoint = await listen(upstream);
  const proxy = createServer((request, response) => {
    if (request.method === 'POST') void classify(request, response, endpoint);
    else reconnect(request, response, 'refresh-test');
  });
  const url = await listen(proxy);
  t.after(() => {
    complete();
    for (const server of [proxy, upstream]) { server.closeAllConnections(); server.close(); }
  });
  const body = new FormData();
  body.append('file', new File(['%PDF-1.4'], 'sample.pdf'));
  const controller = new AbortController();
  const response = await fetch(url, { method: 'POST', headers: { 'X-Run-ID': 'refresh-test' }, body, signal: controller.signal });
  const first = new TextDecoder().decode((await response.body.getReader().read()).value);
  assert.match(first, /id: 1\nevent: step_started/);
  controller.abort();
  const resumed = await fetch(url, { headers: { 'Last-Event-ID': '1' } });
  complete();
  const remaining = await resumed.text();
  assert.match(remaining, /id: 2\nevent: result/);
  assert.doesNotMatch(remaining, /step_started/);
  assert.equal(calls, 1);
  const replay = await (await fetch(url)).text();
  assert.match(replay, /step_started/);
  assert.match(replay, /event: result/);
});
