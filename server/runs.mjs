const retentionMs = 60 * 60 * 1000;
const runs = new Map();

export function createRun(id) {
  const run = { id, events: [], clients: new Set(), controller: new AbortController(), finished: false };
  runs.set(id, run);
  return run;
}

export function getRun(id) {
  return runs.get(id);
}

export function publish(run, frame) {
  const hasData = /^data:/m.test(frame);
  const chunk = hasData ? `id: ${run.events.length + 1}\n${frame}\n\n` : `${frame}\n\n`;
  if (hasData) run.events.push(chunk);
  for (const client of run.clients) client.write(chunk);
}

export function finish(run) {
  run.finished = true;
  for (const client of run.clients) client.end();
  run.clients.clear();
  setTimeout(() => runs.delete(run.id), retentionMs).unref();
}

export function subscribe(run, response, cursor = 0) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders();
  for (const chunk of run.events.slice(cursor)) response.write(chunk);
  if (run.finished) response.end();
  else {
    run.clients.add(response);
    response.on('close', () => run.clients.delete(response));
  }
}

export function reconnect(request, response, id) {
  const run = getRun(id);
  if (!run) {
    response.writeHead(404).end('This run is no longer available. Send the PDF again.');
    return;
  }
  if (request.method === 'DELETE') {
    run.controller.abort();
    response.writeHead(204).end();
    return;
  }
  const cursor = Number(request.headers['last-event-id'] || 0);
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > run.events.length) {
    response.writeHead(400).end('Invalid stream position.');
    return;
  }
  subscribe(run, response, cursor);
}
