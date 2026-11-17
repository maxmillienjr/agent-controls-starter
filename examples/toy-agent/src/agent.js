// A tiny agent loop for a bike shop's service desk. The model is a function passed in, so
// the tests drive it with a scripted fake and nothing here calls a network.

import { checkToolCall, tools } from './tools.js';
import { redactCustomer } from './redact.js';

export const MAX_STEPS = 6;

export function runAgent(request, model) {
  const transcript = [{ role: 'user', content: redactCustomer(request) }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = model(transcript);
    if (reply.type === 'answer') return { ok: true, answer: reply.content, steps: step + 1 };
    const verdict = checkToolCall(reply);
    if (!verdict.ok) return { ok: false, refused: verdict.reason, steps: step + 1 };
    const result = tools[reply.tool](reply.args ?? {});
    transcript.push({ role: 'tool', tool: reply.tool, content: JSON.stringify(result) });
  }
  return { ok: false, stopped: `step budget of ${MAX_STEPS} spent`, steps: MAX_STEPS };
}
