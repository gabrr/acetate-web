import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { followJob } from '../public/jobs.js';
const { fetchEventSource } = createRequire(import.meta.url)('@microsoft/fetch-event-source');
const id = '00000000-0000-4000-8000-000000000001';
const result = { transactions: [{ description: 'Example', amount: '12.00' }] };
const sse = (text) => new Response(text, { headers: { 'Content-Type': 'text/event-stream' } });
function browser(t, fetchImplementation) {
  const originals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
  Object.assign(globalThis, { window: { clearTimeout, setTimeout }, document: { removeEventListener() {} }, fetch: fetchImplementation });
  t.after(() => Object.assign(globalThis, originals));
}

test('upload creates one authenticated job, persists its ID, then follows its events', async t => {
  const paths = [];
  browser(t, async (url, options) => {
    paths.push(url);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (url === '/api/jobs') {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Idempotency-Key'], 'upload-key');
      assert.equal(options.body.get('file').name, 'example.pdf');
      return Response.json({ id, status: 'queued' }, { status: 202 });
    }
    return sse(`id: 3\nevent: result\ndata: ${JSON.stringify(result)}\n\n`);
  });
  let saved;
  let cursor;
  let output;
  await followJob(new File(['%PDF-1.4'], 'example.pdf'), event => output = event.result, fetchEventSource, {
    runId: 'upload-key', getToken: async () => 'test-token', onJob: value => saved = value, onCursor: value => cursor = value,
  });
  assert.deepEqual(paths, ['/api/jobs', `/api/jobs/${id}/events`]);
  assert.equal(saved, id);
  assert.equal(cursor, 3);
  assert.deepEqual(output, result);
});

test('resume uses the durable job and saved cursor without reuploading', async t => {
  browser(t, async (url, options) => {
    assert.equal(url, `/api/jobs/${id}/events`);
    assert.equal(options.headers['Last-Event-ID'], '2');
    assert.equal(options.body, undefined);
    return sse(`id: 3\nevent: result\ndata: ${JSON.stringify(result)}\n\n`);
  });
  await followJob(null, () => {}, fetchEventSource, { resume: true, jobId: id, cursor: 2, getToken: async () => 'token' });
});

test('closed stream retrieves a completed result instead of failing or reuploading', async t => {
  const paths = [];
  browser(t, async url => {
    paths.push(url);
    if (url.endsWith('/events')) return sse(': heartbeat\n\n');
    if (url.endsWith('/result')) return Response.json(result);
    return Response.json({ id, status: 'succeeded' });
  });
  let received;
  await followJob(null, value => received = value.result, fetchEventSource, { resume: true, jobId: id, getToken: async () => 'token' });
  assert.deepEqual(received, result);
  assert.deepEqual(paths, [`/api/jobs/${id}/events`, `/api/jobs/${id}`, `/api/jobs/${id}/result`]);
});

test('backend failure is surfaced without retrying the upload', async t => {
  browser(t, async url => url.endsWith('/events') ? sse(': heartbeat\n\n') : Response.json({ id, status: 'failed', error_reason: 'Unreadable statement' }));
  await assert.rejects(followJob(null, () => {}, fetchEventSource, { resume: true, jobId: id, getToken: async () => 'token' }), /Unreadable statement/);
});

test('old saved run cannot accidentally submit another job', async () => {
  await assert.rejects(followJob(null, () => {}, fetchEventSource, { resume: true, getToken: async () => 'token' }), /older app/);
});
