import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId } from './requestId.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function cryptoFor(t, provider) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: provider });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'crypto', descriptor) : delete globalThis.crypto);
}

test('uses native randomUUID when available', t => {
  cryptoFor(t, { randomUUID: () => 'native-uuid' });
  assert.equal(createRequestId(), 'native-uuid');
});

test('LAN HTTP uses getRandomValues and produces a valid UUID v4', t => {
  cryptoFor(t, { getRandomValues: bytes => bytes.fill(255) });
  assert.match(createRequestId(), uuid);
  assert.equal(createRequestId(), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
});

test('missing crypto does not crash and legacy IDs remain distinct', t => {
  cryptoFor(t, undefined);
  t.mock.method(Math, 'random', () => 0);
  const values = Array.from({ length: 100 }, createRequestId);
  assert.equal(new Set(values).size, 100);
  assert.ok(values.every(value => uuid.test(value)));
});
