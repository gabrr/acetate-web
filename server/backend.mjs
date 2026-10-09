import { once } from 'node:events';

export function isBackendRoute(path, method) {
  const id = '[0-9a-fA-F-]{36}';
  return (path === '/auth/me' && method === 'GET') ||
    (path === '/api/jobs' && method === 'POST') ||
    (new RegExp(`^/api/jobs/${id}(?:/(?:events|result))?$`).test(path) && method === 'GET') ||
    (new RegExp(`^/api/jobs/${id}/retry$`).test(path) && method === 'POST');
}

export async function proxyBackend(request, response, backendUrl, { streamWindowMs = 45_000 } = {}) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!isBackendRoute(path, request.method)) {
    response.writeHead(404).end('Not found');
    return;
  }
  if (!request.headers.authorization?.startsWith('Bearer ')) {
    response.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ detail: 'Sign in required.' }));
    return;
  }
  if (!backendUrl) {
    response.writeHead(503).end('Backend is not configured.');
    return;
  }
  const controller = new AbortController();
  const disconnect = () => controller.abort();
  response.on('close', disconnect);
  const streaming = path.endsWith('/events');
  const timeout = setTimeout(() => controller.abort(), streaming ? streamWindowMs : 50_000);
  try {
    const headers = { Authorization: request.headers.authorization, Accept: streaming ? 'text/event-stream' : 'application/json' };
    for (const name of ['content-type', 'idempotency-key', 'last-event-id']) {
      if (request.headers[name]) headers[name] = request.headers[name];
    }
    const upstream = await fetch(new URL(path, backendUrl), {
      method: request.method, headers, signal: controller.signal,
      ...(request.method === 'POST' ? { body: request, duplex: 'half' } : {}),
    });
    response.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store, no-transform',
      ...(streaming ? { 'X-Accel-Buffering': 'no' } : {}),
    });
    if (streaming) response.flushHeaders();
    if (upstream.body) {
      for await (const chunk of upstream.body) {
        if (!response.write(chunk)) await once(response, 'drain', { signal: controller.signal });
      }
    }
  } catch (error) {
    if (!response.headersSent && !response.destroyed) {
      response.writeHead(502, { 'Content-Type': 'application/json' }).write(JSON.stringify({ detail: 'Backend connection unavailable. Please try again.' }));
    }
  } finally {
    clearTimeout(timeout);
    response.off('close', disconnect);
    controller.abort();
    if (!response.destroyed) response.end();
  }
}
