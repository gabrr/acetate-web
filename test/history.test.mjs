import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHistory, saveRun } from '../public/history.js';

const storage = () => {
  let value = null;
  return { getItem: () => value, setItem: (key, next) => { value = next; } };
};
const run = (name, id, status = 'completed') => ({ id, file: { name, size: 12 }, status, steps: [], result: { transactions: [] } });

test('same filename groups versions and progress replaces only its own version', () => {
  const store = storage();
  const groups = [];
  saveRun(groups, run('statement.pdf', 'first', 'running'), store);
  saveRun(groups, run('statement.pdf', 'first'), store);
  saveRun(groups, run('statement.pdf', 'second'), store);
  saveRun(groups, run('other.pdf', 'third'), store);
  const restored = loadHistory(store);
  assert.equal(restored.length, 2);
  assert.equal(restored[0].id, 'statement.pdf');
  assert.deepEqual(restored[0].versions.map(value => value.id), ['first', 'second']);
  assert.equal(restored[0].versions[0].status, 'completed');
});

test('corrupt saved data and unavailable storage report failures', () => {
  assert.throws(() => loadHistory({ getItem: () => '{broken' }));
  assert.throws(() => loadHistory({ getItem: () => '{"schema":2,"groups":[]}' }), /could not be read/);
  assert.throws(() => saveRun([], run('file.pdf', 'first'), { setItem() { throw new Error('Quota exceeded'); } }), /Quota exceeded/);
});
