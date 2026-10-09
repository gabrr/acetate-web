import { normalizeEvent } from './model.js';

export async function streamClassification(file, onEvent, connect, {
  signal,
  runId,
  resume = false,
  cursor = 0,
  onCursor = () => {},
  idleTimeoutMs = 120_000,
  url,
  getToken,
} = {}) {
  signal?.throwIfAborted();
  const body = resume ? undefined : new FormData();
  if (body) body.append('file', file);
  const controller = new AbortController();
  let finished = false;
  let idleTimer;

  function resetIdleTimer() {
    if (controller.signal.aborted) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      controller.abort(new Error('The classifier stopped responding. Please try again.'));
    }, idleTimeoutMs);
  }

  const cancel = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  resetIdleTimer();

  try {
    await connect(url || (resume ? `/api/runs/${runId}` : '/api/classify'), {
      method: resume ? 'GET' : 'POST',
      headers: { ...(runId ? { 'X-Run-ID': runId } : {}), ...(cursor ? { 'Last-Event-ID': String(cursor) } : {}) },
      body,
      signal: controller.signal,
      openWhenHidden: true,
      async fetch(url, options) {
        if (getToken) options.headers = { ...options.headers, Authorization: `Bearer ${await getToken()}` };
        const response = await fetch(url, options);
        resetIdleTimer();
        if (!response.body) return response;

        // Count all incoming bytes, including SSE heartbeat comments, as activity.
        const monitored = response.body.pipeThrough(new TransformStream({
          transform(chunk, sink) {
            resetIdleTimer();
            sink.enqueue(chunk);
          },
        }));
        return new Response(monitored, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      },
      async onopen(response) {
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 500);
          const error = new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : detail || `Request failed (${response.status}).`);
          error.status = response.status;
          throw error;
        }
        if (!response.headers.get('content-type')?.startsWith('text/event-stream')) {
          throw new Error('The classifier did not return an event stream.');
        }
      },
      onmessage(message) {
        if (finished || !message.data.trim()) return;
        if (message.event === 'session_expired') { const error = new Error('Your session expired. Please sign in again.'); error.status = 401; throw error; }
        const event = normalizeEvent(message.event, JSON.parse(message.data));
        if (!event) return;
        if (message.id) onCursor(Number(message.id));
        onEvent(event);

        if (event.type === 'result') {
          finished = true;
          controller.abort();
        }
      },
      onclose() {
        if (!finished) { const error = new Error('The stream ended before a final result arrived.'); error.retryable = true; throw error; }
      },
      onerror(error) { throw error; },
    });

    // fetch-event-source resolves on abort; cancellation and timeout must still fail the run.
    if (!finished) {
      controller.signal.throwIfAborted();
      throw new Error('The stream ended before a final result arrived.');
    }
  } finally {
    clearTimeout(idleTimer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
