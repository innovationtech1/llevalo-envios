import type { Quote, Settings, SizeId, Zone } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Precio al cliente = base + millas × precio por milla + extra por tamaño, nunca menos del mínimo. */
export function quote(settings: Settings, miles: number, size: SizeId): Quote {
  const extra = Number(settings.extras[size] ?? 0);
  const byMiles = settings.perMile * miles;
  const raw = settings.base + byMiles + extra;
  return {
    base: round2(settings.base),
    byMiles: round2(byMiles),
    extra: round2(extra),
    minimumApplied: raw < settings.minimum,
    total: round2(Math.max(settings.minimum, raw)),
    driverPay: round2(settings.driverBase + settings.driverPerMile * miles)
  };
}

export function zoneForZip(zones: Zone[], zip: string | undefined | null): Zone | null {
  if (!zip) return null;
  const z = String(zip).trim();
  if (!/^\d{5}$/.test(z)) return null;
  return zones.find((zone) => zone.local && zone.prefixes.some((p) => p && z.startsWith(p))) ?? null;
}
