import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quote, zoneForZip } from '../src/lib/pricing.ts';
import type { Settings, Zone } from '../src/lib/types.ts';

const settings: Settings = {
  base: 6, perMile: 1.75, minimum: 8,
  extras: { sobre: 0, pequeno: 0, mediano: 3, grande: 8 },
  driverBase: 3, driverPerMile: 1.1, maxMiles: 30, cancelFee: 5, coverageMax: 100, instantPayouts: true, edited: false
};

test('aplica el precio mínimo en viajes cortos', () => {
  const q = quote(settings, 1, 'pequeno');
  assert.equal(q.total, 8);
  assert.equal(q.minimumApplied, true);
});

test('suma base + millas + extra por tamaño', () => {
  const q = quote(settings, 5, 'grande');
  assert.equal(q.total, 22.75); // 6 + 8.75 + 8
  assert.equal(q.driverPay, 8.5); // 3 + 5.5
});

test('redondea a centavos', () => {
  assert.equal(quote(settings, 3.33, 'pequeno').total, 11.83);
});

test('zonas por prefijo de código postal', () => {
  const zones: Zone[] = [
    { id: 'a', name: 'Centro', prefixes: ['782'], local: true },
    { id: 'b', name: 'Apagada', prefixes: ['781'], local: false }
  ];
  assert.equal(zoneForZip(zones, '78209')?.name, 'Centro');
  assert.equal(zoneForZip(zones, '78109'), null);
  assert.equal(zoneForZip(zones, '7820'), null);
  assert.equal(zoneForZip(zones, ''), null);
});
