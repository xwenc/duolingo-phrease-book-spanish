import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpanish, evaluateSpokenSpanish } from './diffAlgorithm.ts';

test('Spanish normalization preserves ñ in both Unicode forms', () => {
  assert.equal(normalizeSpanish('¡AÑO, niño, España!'), 'año niño españa');
  assert.equal(normalizeSpanish('AN\u0303O'), 'año');
  assert.equal(normalizeSpanish('áéíóú ü'), 'aeiou u');
  assert.equal(evaluateSpokenSpanish('año', 'an\u0303o').score, 100);
});

test('n is not treated as ñ by exact or fuzzy matching', () => {
  assert.equal(evaluateSpokenSpanish('año', 'ano').score, 0);
  assert.equal(evaluateSpokenSpanish('niño', 'nino').score, 0);
  assert.equal(evaluateSpokenSpanish('España', 'Espana').score, 0);
});
