export function normalizeEvent(event, data) {
  if (event === 'error') throw new Error(data.message || data.error || 'The classifier failed.');

  if (event === 'result') {
    const result = data.result || data;
    if (!Array.isArray(result.transactions)) throw new Error('The result must include transactions.');
    return { type: 'result', result };
  }

  if (!['step_started', 'step_completed'].includes(event)) return null;

  const id = data.step_id || data.id || data.step;
  if (typeof id !== 'string' || !id) throw new Error('A workflow step is missing its ID.');

  return {
    type: 'step',
    step: {
      id,
      name: data.name || data.step_name || id,
      state: event === 'step_started' ? 'running' : 'completed',
      output: data.output,
      outputType: data.output_type || (typeof data.output === 'object' ? 'json' : 'text'),
    },
  };
}

export function sortTransactions(transactions, field = 'classification_confidence', direction = 'asc') {
  const sign = direction === 'desc' ? -1 : 1;
  const numeric = field === 'amount' || field === 'classification_confidence';
  const value = (row) => {
    const raw = row[field];
    if (raw === null || raw === undefined || raw === '') return null;
    if (!numeric) return String(raw);
    const number = Number(raw);
    return Number.isFinite(number) ? number : null;
  };

  return [...transactions].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return sign * (numeric ? left - right : left.localeCompare(right, undefined, { sensitivity: 'base' }));
  });
}

export function formatOutput(step) {
  if (step.output === undefined) return 'Waiting for this step to finish…';
  if (typeof step.output === 'string') {
    if (step.outputType === 'json') {
      try { return JSON.stringify(JSON.parse(step.output), null, 2); }
      catch { return step.output; }
    }
    return step.output;
  }
  return JSON.stringify(step.output, null, 2);
}
