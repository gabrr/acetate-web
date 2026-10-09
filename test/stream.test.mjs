import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { streamClassification } from '../public/stream.js';

const { fetchEventSource } = createRequire(import.meta.url)('@microsoft/fetch-event-source');
const pdf = new File(['%PDF-1.4'], 'sample.pdf', { type: 'application/pdf' });
const encode = new TextEncoder();
const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

function mockBrowser(t, fetchImplementation) {
  const originals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  globalThis.window = { clearTimeout, setTimeout };
  globalThis.document = { removeEventListener() {} };
  globalThis.fetch = fetchImplementation;
  t.after(() => Object.assign(globalThis, originals));
}

function response(text) {
  return new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });
}

test('real SSE parser delivers fragmented events and finishes without retrying', async (t) => {
  let requests = 0;
  mockBrowser(t, async (url, options) => {
    requests++;
    assert.equal(url, '/api/classify');
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('file').name, 'sample.pdf');
    const bytes = encode.encode(event('step_completed', { step_id: 'read', output: 'hello' }) + event('result', { statement: { total: '12.00' }, transactions: [] }));
    return response(new ReadableStream({ start(sink) {
      for (let i = 0; i < bytes.length; i += 7) sink.enqueue(bytes.slice(i, i + 7));
      sink.close();
    } }));
  });
  const received = [];
  await streamClassification(pdf, (value) => received.push(value), fetchEventSource);
  assert.deepEqual(received.map(value => value.type), ['step', 'result']);
  assert.equal(received[1].result.statement.total, '12.00');
  assert.equal(requests, 1);
});

test('user cancellation aborts a pending request and rejects as cancelled', async (t) => {
  let upstreamSignal;
  const controller = new AbortController();
  mockBrowser(t, (url, options) => new Promise((resolve, reject) => {
    upstreamSignal = options.signal;
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  const run = streamClassification(pdf, () => {}, fetchEventSource, { signal: controller.signal });
  controller.abort();
  await assert.rejects(run, { name: 'AbortError' });
  assert.equal(upstreamSignal.aborted, true);
});

test('inactivity timeout rejects and aborts the pending request', async (t) => {
  let upstreamSignal;
  mockBrowser(t, (url, options) => new Promise((resolve, reject) => {
    upstreamSignal = options.signal;
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  await assert.rejects(streamClassification(pdf, () => {}, fetchEventSource, { idleTimeoutMs: 20 }), /stopped responding/);
  assert.equal(upstreamSignal.aborted, true);
});

test('heartbeat comments keep an active stream alive', async (t) => {
  let beat;
  let finish;
  t.after(() => { clearInterval(beat); clearTimeout(finish); });
  mockBrowser(t, async () => response(new ReadableStream({ start(sink) {
    beat = setInterval(() => sink.enqueue(encode.encode(': heartbeat\n\n')), 10);
    finish = setTimeout(() => {
      clearInterval(beat);
      sink.enqueue(encode.encode(event('result', { transactions: [] })));
      sink.close();
    }, 100);
  } })));
  await streamClassification(pdf, () => {}, fetchEventSource, { idleTimeoutMs: 40 });
});

test('premature closure and provider errors fail without retries', async (t) => {
  let requests = 0;
  let content = ': heartbeat\n\n';
  mockBrowser(t, async () => { requests++; return response(content); });
  await assert.rejects(streamClassification(pdf, () => {}, fetchEventSource), /before a final result/);
  content = event('error', { message: 'Provider failed' });
  await assert.rejects(streamClassification(pdf, () => {}, fetchEventSource), /Provider failed/);
  assert.equal(requests, 2);
});

test('resume uses GET with the saved event cursor and no upload', async t => {
  mockBrowser(t, async (url, options) => {
    assert.equal(url, '/api/runs/saved-run');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers['Last-Event-ID'], '2');
    assert.equal(options.body, undefined);
    return response('id: 3\n' + event('result', { transactions: [] }));
  });
  let cursor;
  await streamClassification(null, () => {}, fetchEventSource, {
    resume: true, runId: 'saved-run', cursor: 2, onCursor: value => { cursor = value; },
  });
  assert.equal(cursor, 3);
});
