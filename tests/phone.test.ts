import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, prettyPhone } from '../src/lib/constants.ts';

test('normaliza teléfonos de EE. UU.', () => {
  assert.equal(normalizePhone('(210) 990-0532'), '+12109900532');
  assert.equal(normalizePhone('1 210 990 0532'), '+12109900532');
  assert.equal(normalizePhone('+1-210-990-0532'), '+12109900532');
  assert.equal(normalizePhone('990-0532'), null);
  assert.equal(normalizePhone('52 55 1234 5678'), null);
});

test('muestra el teléfono bonito', () => {
  assert.equal(prettyPhone('+12109900532'), '(210) 990-0532');
});
