import { marked } from '/vendor/marked.js';
import DOMPurify from '/vendor/dompurify.js';
import { formatStepTime } from './timer.js';
import { formatOutput, sortTransactions } from './model.js';

const byId = (id) => document.getElementById(id);
export const elements = Object.fromEntries(['upload', 'file', 'send', 'status', 'timer', 'error', 'steps', 'attachment', 'results', 'transactions', 'count', 'output', 'output-title', 'copy', 'source-output', 'markdown-output', 'cancel', 'inspect-result', 'results-placeholder', 'history-controls', 'saved-file', 'versions', 'storage-error', 'sort-label'].map((id) => [id, byId(id)]));

export function showAttachment(file, url) {
  const link = document.createElement(url ? 'a' : 'div');
  link.className = 'attachment';
  if (url) {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
  }
  const icon = document.createElement('img');
  icon.src = '/vendor/file-pdf.svg';
  icon.alt = 'PDF';
  const name = document.createElement('span');
  name.textContent = file.name;
  const detail = document.createElement('small');
  detail.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB · ${url ? 'Open PDF' : 'Saved run'}`;
  name.append(detail);
  link.append(icon, name);
  elements.attachment.replaceChildren(link);
  elements.attachment.hidden = false;
}

export function showSteps(steps, selected, onSelect) {
  const rows = [...steps.values()].map((step) => {
    const row = document.createElement('li');
    row.dataset.state = step.state;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'step';
    button.setAttribute('aria-pressed', String(selected === step.id));
    const marker = document.createElement('span');
    marker.className = 'step-marker';
    marker.setAttribute('aria-hidden', 'true');
    if (step.state === 'completed') {
      const check = document.createElement('img');
      check.src = '/assets/check.svg';
      check.alt = '';
      marker.append(check);
    }
    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = step.name;
    const state = document.createElement('small');
    state.textContent = { running: 'In progress', completed: 'Completed', failed: 'Failed' }[step.state];
    const elapsed = document.createElement('span');
    elapsed.dataset.stepTime = step.id;
    elapsed.textContent = formatStepTime(step);
    state.append(elapsed);
    button.append(marker, label, state);
    button.onclick = () => onSelect(step.id);
    row.append(button);
    return row;
  });
  elements.steps.replaceChildren(...rows);
}

export function showOutput(step) {
  elements['output-title'].textContent = step?.name || 'Step output';
  const source = step ? formatOutput(step) : 'Select a step to see its output.';
  const isMarkdown = step?.outputType === 'markdown' && step.output !== undefined;
  elements.output.textContent = source;
  elements['source-output'].hidden = isMarkdown;
  elements['markdown-output'].hidden = !isMarkdown;
  elements['markdown-output'].replaceChildren();

  if (isMarkdown) {
    const fragment = DOMPurify.sanitize(marked.parse(source), {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['img', 'style', 'form', 'input', 'button'],
      FORBID_ATTR: ['style', 'id', 'name'],
      RETURN_DOM_FRAGMENT: true,
    });
    elements['markdown-output'].append(fragment);
  }
  elements.copy.disabled = step?.output === undefined;
}

export function showResults(result, sort = { field: 'classification_confidence', direction: 'asc' }) {
  const rows = sortTransactions(result.transactions, sort.field, sort.direction).map((transaction) => {
    const row = document.createElement('tr');
    const confidence = transaction.classification_confidence;
    const values = [transaction.description, transaction.amount, transaction.report_bucket, typeof confidence === 'number' ? `${(confidence * 100).toFixed(1)}%` : '—'];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value ?? '—';
      row.append(cell);
    }
    return row;
  });
  elements.transactions.replaceChildren(...rows);
  elements.count.textContent = `(${rows.length})`;
  elements.results.hidden = false;
  elements['results-placeholder'].hidden = true;
  const labels = { description: 'Description', amount: 'Amount', report_bucket: 'Category', classification_confidence: 'Confidence' };
  for (const button of document.querySelectorAll('[data-sort]')) {
    const active = button.dataset.sort === sort.field;
    button.textContent = labels[button.dataset.sort] + (active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : '');
    button.closest('th').setAttribute('aria-sort', active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
  }
  elements['sort-label'].textContent = sort.field === 'classification_confidence' && sort.direction === 'asc'
    ? 'Lowest confidence first'
    : `${labels[sort.field]} · ${sort.direction === 'asc' ? 'ascending' : 'descending'}`;
}

export function updateStepTimings(steps) {
  for (const element of elements.steps.querySelectorAll('[data-step-time]')) {
    const step = steps.get(element.dataset.stepTime);
    if (step) element.textContent = formatStepTime(step);
  }
}

export function showHistory(groups, activeFile, activeVersion, busy, onSelect) {
  elements['history-controls'].hidden = groups.length === 0;
  elements['saved-file'].replaceChildren(...[...groups].sort((a, b) => a.id.localeCompare(b.id)).map(group => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.id;
    return option;
  }));
  elements['saved-file'].value = activeFile || '';
  elements['saved-file'].disabled = busy;
  const group = groups.find(value => value.id === activeFile);
  elements.versions.replaceChildren(...(group?.versions || []).map((run, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'outline secondary';
    button.textContent = `V${index + 1}`;
    button.title = new Date(run.createdAt).toLocaleString();
    button.setAttribute('aria-pressed', String(run.id === activeVersion));
    button.disabled = busy;
    button.onclick = () => onSelect(run);
    return button;
  }));
}
