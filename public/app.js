import { loadHistory, saveRun } from './history.js';
import { classify } from './api.js';
import { authReady, getSession } from './auth.js';
import { createRunTimer, trackStep, formatDuration } from './timer.js';
import { elements, showAttachment, showSteps, showOutput, showResults, updateStepTimings, showHistory } from './view.js';

const steps = new Map();
const timer = createRunTimer(elements.timer, () => updateStepTimings(steps));
let selected = null;
const attachmentUrls = new Map();
let busy = false;
let leavingPage = false;
window.addEventListener('pagehide', () => { leavingPage = true; });
window.addEventListener('beforeunload', () => { leavingPage = true; });
let runController = null;
let finalResult = null;
let history = [];
let storage = null;
let accountId = null;
let currentRun = null;
let runStartedAt = null;
let sort = { field: 'classification_confidence', direction: 'asc' };

function refreshHistory() {
  showHistory(history, currentRun?.file.name, currentRun?.id, busy, restoreRun);
}

function persistRun() {
  if (!storage || !currentRun) return;
  const now = performance.now();
  const snapshot = {
    ...currentRun,
    elapsedMs: now - runStartedAt,
    error: elements.error.hidden ? null : elements.error.textContent,
    result: finalResult,
    steps: [...steps.values()].map(({ startedAt, endedAt, ...step }) => ({
      ...step,
      durationMs: (endedAt ?? now) - startedAt,
    })),
  };
  try {
    saveRun(history, snapshot, storage);
    elements['storage-error'].hidden = true;
  } catch {
    elements['storage-error'].textContent = 'Run could not be saved locally. Browser storage may be full or unavailable.';
    elements['storage-error'].hidden = false;
  }
  refreshHistory();
}

function restoreRun(run) {
  if (busy) return;
  currentRun = run;
  finalResult = run.result;
  sort = { field: 'classification_confidence', direction: 'asc' };
  steps.clear();
  for (const step of run.steps) {
    steps.set(step.id, { ...step, state: step.state, startedAt: step.state === 'running' ? performance.now() - step.durationMs : 0, endedAt: step.state === 'running' ? null : step.durationMs });
  }
  selected = steps.keys().next().value || null;
  showAttachment(run.file, attachmentUrls.get(run.id));
  showSteps(steps, selected, selectStep);
  showOutput(steps.get(selected));
  elements.results.hidden = !finalResult;
  elements['results-placeholder'].hidden = !!finalResult;
  if (finalResult) showResults(finalResult, sort);
  elements.error.hidden = !run.error;
  elements.error.textContent = run.error || '';
  elements.status.textContent = { running: run.resumable ? 'Reconnecting to classification…' : 'This older run was interrupted. Send the PDF again.', completed: 'Classification complete.', cancelled: 'Classification cancelled.', failed: 'Classification stopped.' }[run.status] || 'Saved run.';
  elements.timer.textContent = `Elapsed ${formatDuration(run.elapsedMs)}`;
  elements.timer.hidden = false;
  refreshHistory();
  if (run.status === 'running' && run.jobId) resumeRun();
}

function selectStep(id) {
  selected = id;
  showSteps(steps, selected, selectStep);
  showOutput(steps.get(id));
}

function receive(event) {
  if (event.type === 'result') {
    finalResult = event.result;
    currentRun.status = 'completed';
    showResults(finalResult, sort);
    elements.status.textContent = 'Classification complete.';
    persistRun();
    return;
  }

  const previous = steps.get(event.step.id);
  steps.set(event.step.id, trackStep(previous, event.step));
  if (!selected) selected = event.step.id;
  showSteps(steps, selected, selectStep);
  if (selected === event.step.id) showOutput(steps.get(selected));
  elements.status.textContent = `${event.step.name} · ${event.step.state === 'completed' ? 'completed' : 'in progress'}`;
  persistRun();
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
}

elements.upload.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!(await getSession())) { showError('Sign in before sending a statement.'); return; }
  const file = elements.file.files[0];
  if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
    showError('Choose a PDF statement.');
    return;
  }

  if (file.size > 4 * 1024 * 1024) { showError('Choose a PDF smaller than 4 MB.'); return; }

  busy = true;
  runStartedAt = performance.now();
  currentRun = { id: crypto.randomUUID(), file: { name: file.name, size: file.size }, createdAt: new Date().toISOString(), status: 'running', resumable: true, cursor: 0 };
  sort = { field: 'classification_confidence', direction: 'asc' };
  timer.start();
  runController = new AbortController();
  elements.cancel.hidden = false;
  finalResult = null;
  elements.send.disabled = true;
  elements.file.disabled = true;
  elements.send.setAttribute('aria-busy', 'true');
  elements.error.hidden = true;
  elements.results.hidden = true;
  elements['results-placeholder'].hidden = false;
  steps.clear();
  selected = null;
  showSteps(steps, selected, selectStep);
  showOutput(null);
  const attachmentUrl = URL.createObjectURL(file);
  attachmentUrls.set(currentRun.id, attachmentUrl);
  showAttachment(file, attachmentUrl);
  elements.status.textContent = 'Sending your statement…';
  persistRun();

  await followRun(file);
});

async function followRun(file, resume = false) {
  const followedRun = currentRun;
  try {
    await classify(file, event => { if (currentRun === followedRun) receive(event); }, {
      signal: runController.signal, runId: currentRun.id, jobId: currentRun.jobId, resume, cursor: currentRun.cursor || 0,
      onCursor: cursor => { if (currentRun === followedRun) currentRun.cursor = cursor; },
      onJob: jobId => { if (currentRun === followedRun) { currentRun.jobId = jobId; persistRun(); } },
    });
  } catch (error) {
    if (leavingPage || currentRun !== followedRun) return;
    const cancelled = error.name === 'AbortError';
    for (const step of steps.values()) {
      if (!cancelled && step.state === 'running') {
        step.state = 'failed';
        step.endedAt = performance.now();
      }
    }
    showSteps(steps, selected, selectStep);
    currentRun.status = cancelled ? 'running' : 'failed';
    elements.status.textContent = cancelled ? 'Stopped watching. Processing continues; reopen this run to resume.' : 'Classification stopped.';
    if (!cancelled) showError(error.message);
  } finally {
    if (leavingPage || currentRun !== followedRun) return;
    timer.stop();
    busy = false;
    runController = null;
    elements.cancel.hidden = true;
    elements.send.disabled = !accountId;
    elements.file.disabled = false;
    elements.send.removeAttribute('aria-busy');
    persistRun();
  }
}

function resumeRun() {
  busy = true;
  runStartedAt = performance.now() - Math.max(0, Date.now() - new Date(currentRun.createdAt).getTime());
  const elapsedMs = performance.now() - runStartedAt;
  for (const step of steps.values()) {
    if (step.state === 'running') step.startedAt -= Math.max(0, elapsedMs - currentRun.elapsedMs);
  }
  timer.start(elapsedMs);
  runController = new AbortController();
  elements.cancel.hidden = false;
  elements.send.disabled = true;
  elements.file.disabled = true;
  elements.send.setAttribute('aria-busy', 'true');
  refreshHistory();
  void followRun(null, true);
}

elements.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(elements.output.textContent);
    elements.copy.textContent = 'Copied';
    setTimeout(() => { elements.copy.textContent = 'Copy'; }, 1500);
  } catch {
    showError('Copy failed. You can select and copy the output directly.');
  }
});

elements.cancel.addEventListener('click', () => {
  runController?.abort();
});

elements['inspect-result'].addEventListener('click', () => {
  if (!finalResult) return;
  selected = null;
  showSteps(steps, selected, selectStep);
  showOutput({ name: 'Complete result', outputType: 'json', output: finalResult });
});

elements['saved-file'].addEventListener('change', () => {
  const group = history.find(value => value.id === elements['saved-file'].value);
  if (group?.versions.length) restoreRun(group.versions.at(-1));
});

for (const button of document.querySelectorAll('[data-sort]')) {
  button.addEventListener('click', () => {
    sort = {
      field: button.dataset.sort,
      direction: sort.field === button.dataset.sort && sort.direction === 'asc' ? 'desc' : 'asc',
    };
    if (finalResult) showResults(finalResult, sort);
  });
}

function changeAccount(session) {
  const id = session?.user?.id || null;
  if (id === accountId) { elements.send.disabled = busy || !id; return; }
  runController?.abort();
  runController = null;
  accountId = id;
  busy = false;
  currentRun = null;
  finalResult = null;
  history = [];
  storage = null;
  steps.clear();
  selected = null;
  for (const url of attachmentUrls.values()) URL.revokeObjectURL(url);
  attachmentUrls.clear();
  timer.stop();
  elements.file.value = '';
  elements.file.disabled = false;
  elements.send.disabled = !id;
  elements.send.removeAttribute('aria-busy');
  elements.cancel.hidden = true;
  elements.results.hidden = true;
  elements['results-placeholder'].hidden = false;
  elements.attachment.hidden = true;
  elements.timer.hidden = true;
  elements.error.hidden = true;
  showSteps(steps, selected, selectStep);
  showOutput(null);
  refreshHistory();
  elements.status.textContent = id ? 'Ready for your statement.' : 'Sign in to send a statement.';
  if (!id) return;
  try {
    storage = {
      getItem: key => localStorage.getItem(`${key}.${id}`),
      setItem: (key, value) => localStorage.setItem(`${key}.${id}`, value),
    };
    history = loadHistory(storage);
    const latest = history.flatMap(group => group.versions).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
    if (latest) restoreRun(latest);
  } catch {
    storage = null;
    elements['storage-error'].textContent = 'Saved runs could not be loaded. Local saving is unavailable.';
    elements['storage-error'].hidden = false;
  }
}

elements.send.disabled = true;
window.addEventListener('acetate-auth', event => changeAccount(event.detail));
await authReady;
changeAccount(await getSession());
