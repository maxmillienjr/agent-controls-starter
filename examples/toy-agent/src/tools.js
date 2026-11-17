// The tools the service-desk agent may call, and the check every call goes through.

export const ALLOWED_TOOLS = new Set(['lookupOrder', 'bookRepair', 'quotePart']);

export function checkToolCall(call) {
  if (!ALLOWED_TOOLS.has(call.tool)) {
    return { ok: false, reason: `tool ${call.tool} is not on the allowlist` };
  }
  return { ok: true };
}

export const tools = {
  lookupOrder: ({ orderId }) => ({ orderId, status: 'ready for pickup' }),
  bookRepair: ({ bike, day }) => ({ bike, day, slot: '10:00' }),
  quotePart: ({ part }) => ({ part, price: part === 'chain' ? 24 : 40 }),
};
