import { randomUUID } from 'node:crypto';
import { createRun, getRun, publish, finish, subscribe } from './runs.mjs';

export async function classify(request, response, endpoint) {
  if (!request.headers['content-type']?.startsWith('multipart/form-data;')) {
    response.writeHead(415).end('Upload a PDF using multipart field "file".');
    return;
  }
  const id = request.headers['x-run-id'] || randomUUID();
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || getRun(id)) {
    response.writeHead(409).end('Invalid or duplicate run.');
    return;
  }
  const run = createRun(id);

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': request.headers['content-type'], Accept: 'text/event-stream' },
      body: request,
      duplex: 'half',
      signal: run.controller.signal,
    });
    if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('text/event-stream')) {
      const detail = (await upstream.text()).slice(0, 500);
      throw new Error(detail || `Classifier request failed (${upstream.status}).`);
    }
    subscribe(run, response);
    const decoder = new TextDecoder();
    let pending = '';
    for await (const chunk of upstream.body) {
      pending += decoder.decode(chunk, { stream: true });
      pending = pending.replace(/\r\n/g, '\n');
      let end;
      while ((end = pending.indexOf('\n\n')) !== -1) {
        publish(run, pending.slice(0, end));
        pending = pending.slice(end + 2);
      }
    }
  } catch (error) {
    const message = run.controller.signal.aborted ? 'Classification cancelled.' : error.message;
    publish(run, `event: error\ndata: ${JSON.stringify({ message })}`);
    if (!response.headersSent && !response.destroyed) subscribe(run, response);
  } finally {
    finish(run);
  }
}
