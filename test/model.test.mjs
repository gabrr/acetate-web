import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, sortTransactions, formatOutput } from '../public/model.js';

test('confidence sorting preserves the original order and puts missing confidence last', () => {
  const input = [{ classification_confidence: .9 }, {}, { classification_confidence: .2 }];
  assert.deepEqual(sortTransactions(input), [input[2], input[0], input[1]]);
  assert.equal(input[0].classification_confidence, .9);
});

test('step output retains raw Markdown and pretty prints JSON', () => {
  const event = normalizeEvent('step_completed', { step_id: 'extract', name: 'Extract', output: { amount: '1.00' } });
  assert.equal(event.step.outputType, 'json');
  assert.equal(formatOutput(event.step), '{\n  "amount": "1.00"\n}');
  assert.equal(formatOutput({ output: '# Statement' }), '# Statement');
});

test('invalid results and workflow errors fail visibly', () => {
  assert.throws(() => normalizeEvent('result', {}), /transactions/);
  assert.throws(() => normalizeEvent('error', { message: 'Provider failed' }), /Provider failed/);
  assert.throws(() => normalizeEvent('step_started', {}), /ID/);
});

test('JSON strings are indented while text retains its whitespace', () => {
  assert.equal(formatOutput({outputType:'json',output:'{"total":"12.00"}'}), '{\n  "total": "12.00"\n}');
  assert.equal(formatOutput({outputType:'text',output:'first\n  second'}), 'first\n  second');
});

test('amount sorting is numeric and keeps missing values last in both directions', () => {
  const rows = [{amount:'100.25'}, {amount:'2.50'}, {amount:'-10.00'}, {amount:null}];
  assert.deepEqual(sortTransactions(rows, 'amount').map(row => row.amount), ['-10.00', '2.50', '100.25', null]);
  assert.deepEqual(sortTransactions(rows, 'amount', 'desc').map(row => row.amount), ['100.25', '2.50', '-10.00', null]);
  assert.equal(rows[0].amount, '100.25');
});

test('description and category sort alphabetically', () => {
  const rows = [{description:'Zulu',report_bucket:'variable'}, {description:'alpha',report_bucket:'fixed'}];
  assert.equal(sortTransactions(rows, 'description')[0].description, 'alpha');
  assert.equal(sortTransactions(rows, 'report_bucket', 'desc')[0].report_bucket, 'variable');
});
