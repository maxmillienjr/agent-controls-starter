import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent, MAX_STEPS } from '../src/agent.js';

const scripted = (...replies) => {
  let i = 0;
  return () => replies[Math.min(i++, replies.length - 1)];
};

test('answers after calling an allowed tool', () => {
  const model = scripted(
    { type: 'tool', tool: 'lookupOrder', args: { orderId: 'A-17' } },
    { type: 'answer', content: 'Your bike is ready for pickup.' },
  );
  const run = runAgent('Is order A-17 done?', model);
  assert.equal(run.ok, true);
  assert.equal(run.steps, 2);
});

test('refuses a tool that is not on the allowlist', () => {
  const model = scripted({ type: 'tool', tool: 'issueRefund', args: { amount: 500 } });
  const run = runAgent('Refund me', model);
  assert.equal(run.ok, false);
  assert.match(run.refused, /issueRefund is not on the allowlist/);
});

test('stops when the step budget is spent', () => {
  const model = scripted({ type: 'tool', tool: 'quotePart', args: { part: 'chain' } });
  const run = runAgent('Quote me a chain', model);
  assert.equal(run.ok, false);
  assert.equal(run.steps, MAX_STEPS);
});

test('sends no email address or phone number to the model', () => {
  let seen = '';
  const model = (transcript) => {
    seen = transcript[0].content;
    return { type: 'answer', content: 'ok' };
  };
  runAgent('Call me on +1 555 010 0199 or write to rider@shop.example', model);
  assert.equal(seen.includes('rider@shop.example'), false);
  assert.equal(seen.includes('555 010 0199'), false);
  assert.match(seen, /\[email\].*|\[phone\]/);
});

// Skipped on purpose: no control cites it, so the lint does not care. A control that cited
// it would fail, because a skipped test cannot fail when the control stops holding.
test.skip('quotes a part the shop does not stock', () => {
  assert.fail('not written yet');
});
