import { streamClassification } from './stream.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function jobRequest(path, getToken, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${await getToken()}` } });
  if (!response.ok) {
    let detail;
    try { detail = (await response.json()).detail; } catch {}
    throw new Error(response.status === 401 ? 'Your session expired. Please sign in again.' : typeof detail === 'string' ? detail : `Request failed (${response.status}).`);
  }
  return response.json();
}

export async function followJob(file, onEvent, connect, {
  signal, runId, jobId, resume = false, cursor = 0,
  onJob = () => {}, onCursor = () => {}, getToken,
} = {}) {
  signal?.throwIfAborted();
  if (!getToken) throw new Error('Sign in required.');
  if (!resume) {
    const body = new FormData();
    body.append('file', file);
    const job = await jobRequest('/api/jobs', getToken, { method: 'POST', body, signal, headers: { 'Idempotency-Key': runId } });
    jobId = job.id;
    if (!uuid.test(jobId)) throw new Error('The backend did not return a valid job ID.');
    onJob(jobId);
  }
  if (!uuid.test(jobId || '')) throw new Error('This saved run uses the older app. Submit the statement again.');
  let streamCursor = cursor;
  let failures = 0;
  while (true) {
    signal?.throwIfAborted();
    try {
      await streamClassification(null, onEvent, connect, {
        signal, resume: true, cursor: streamCursor, url: `/api/jobs/${jobId}/events`, getToken,
        onCursor: value => { streamCursor = value; onCursor(value); },
      });
      return;
    } catch (error) {
      signal?.throwIfAborted();
      if (!error.retryable && !(error instanceof TypeError) && error.status !== 401) throw error;
      const job = await jobRequest(`/api/jobs/${jobId}`, getToken, { signal });
      if (job.status === 'succeeded') {
        const result = await jobRequest(`/api/jobs/${jobId}/result`, getToken, { signal });
        onEvent({ type: 'result', result });
        return;
      }
      if (job.status === 'failed') throw new Error(job.error_reason || 'Statement processing failed.');
      if (error.status === 401 && ++failures > 2) throw error;
      // A closed connection is expected at the hosting time limit; the durable job continues.
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 1000);
        signal?.addEventListener('abort', abort, { once: true });
      });
    }
  }
}
