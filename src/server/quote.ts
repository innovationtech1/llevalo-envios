import 'server-only';
import { quote, zoneForZip } from '@/lib/pricing';
import type { Place, QuoteResponse, SizeId } from '@/lib/types';
import { getRepo } from './repo';
import { routeMiles } from './geo';

/** Cotización oficial: siempre se calcula en el servidor con las tarifas guardadas. */
export async function buildQuote(pickup: Place, dropoff: Place, size: SizeId): Promise<QuoteResponse> {
  const repo = getRepo();
  const [settings, zones, route] = await Promise.all([repo.getSettings(), repo.getZones(), routeMiles(pickup, dropoff)]);
  const problems: string[] = [];
  if (!zoneForZip(zones, pickup.zip)) problems.push('La dirección de recolección está fuera de nuestras zonas.');
  if (!zoneForZip(zones, dropoff.zip)) problems.push('La dirección de entrega está fuera de nuestras zonas.');
  if (route.miles > settings.maxMiles) problems.push(`La distancia supera el máximo de ${settings.maxMiles} millas.`);
  return { route, quote: quote(settings, route.miles, size), problems };
}
