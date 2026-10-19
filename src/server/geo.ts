import 'server-only';
import type { Place, RouteInfo, Suggestion } from '@/lib/types';

/**
 * Direcciones y millas, del lado del servidor (la clave de Google nunca llega al celular).
 * Con GOOGLE_MAPS_API_KEY: Places API (New) para autocompletar, Geocoding API para búsqueda
 * y Routes API para las millas en auto. Sin ella: OpenStreetMap (Nominatim + OSRM).
 */
const GOOGLE = process.env.GOOGLE_MAPS_API_KEY;
const UA = `Llevalo/0.3 (${process.env.CONTACT_EMAIL || 'contacto@llevalo.app'})`;
const SA = { latitude: 29.4241, longitude: -98.4936 }; // San Antonio, TX

export const mapsProvider = (): 'google' | 'osm' => (GOOGLE ? 'google' : 'osm');

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const zipFrom = (components: { types: string[]; shortText?: string; short_name?: string }[] = []) => {
  const c = components.find((x) => x.types.includes('postal_code'));
  return (c?.shortText ?? c?.short_name ?? '').slice(0, 5);
};
const cleanLabel = (s: string) => s.replace(/, (USA|EE\. UU\.|Estados Unidos)$/, '');

/* ---------- autocompletar (solo Google) ---------- */
export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  if (!GOOGLE) return [];
  const data = await fetchJson('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE },
    body: JSON.stringify({
      input, sessionToken, languageCode: 'es', regionCode: 'us', includedRegionCodes: ['us'],
      locationBias: { circle: { center: SA, radius: 50000 } }
    })
  });
  type Pred = { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } };
  return ((data.suggestions || []) as Pred[])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<Pred['placePrediction']> => Boolean(p))
    .slice(0, 5)
    .map((p) => ({
      id: p.placeId,
      main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
      secondary: cleanLabel(p.structuredFormat?.secondaryText?.text ?? '')
    }));
}

export async function placeDetails(placeId: string, sessionToken: string): Promise<Place> {
  if (!GOOGLE) throw new Error('Google Maps no está configurado');
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=es&sessionToken=${encodeURIComponent(sessionToken)}`;
  const d = await fetchJson(url, { headers: { 'X-Goog-Api-Key': GOOGLE, 'X-Goog-FieldMask': 'formattedAddress,location,addressComponents' } });
  return { label: cleanLabel(d.formattedAddress), lat: d.location.latitude, lon: d.location.longitude, zip: zipFrom(d.addressComponents) };
}

/* ---------- búsqueda por texto ---------- */
export async function geocode(q: string): Promise<Place[]> {
  return GOOGLE ? geocodeGoogle(q) : geocodeOsm(q);
}

async function geocodeGoogle(q: string): Promise<Place[]> {
  const params = new URLSearchParams({ address: q, components: 'country:US', bounds: '29.1,-99.2|29.9,-97.9', language: 'es', key: GOOGLE! });
  const data = await fetchJson('https://maps.googleapis.com/maps/api/geocode/json?' + params);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error('Google: ' + data.status);
  type R = { formatted_address: string; geometry: { location: { lat: number; lng: number } }; address_components: { types: string[]; short_name: string }[] };
  return ((data.results || []) as R[]).slice(0, 5).map((r) => ({
    label: cleanLabel(r.formatted_address), lat: r.geometry.location.lat, lon: r.geometry.location.lng, zip: zipFrom(r.address_components)
  }));
}

interface OsmResult { lat: string; lon: string; name?: string; display_name: string; address?: Record<string, string> }
function osmLabel(r: OsmResult) {
  const a = r.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.hamlet || a.suburb || '';
  const parts = [street || r.name, city, a.state, a.postcode].filter(Boolean);
  return parts.length ? parts.join(', ') : r.display_name;
}

async function geocodeOsm(q: string): Promise<Place[]> {
  const params = new URLSearchParams({
    q, format: 'jsonv2', addressdetails: '1', countrycodes: 'us', limit: '5',
    viewbox: '-99.2,29.9,-97.9,29.1', bounded: '0', 'accept-language': 'es'
  });
  const list: OsmResult[] = await fetchJson('https://nominatim.openstreetmap.org/search?' + params, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  return list.map((r) => ({ label: osmLabel(r), lat: Number(r.lat), lon: Number(r.lon), zip: r.address?.postcode ? String(r.address.postcode).slice(0, 5) : '' }));
}

/* ---------- distancia en auto ---------- */
function haversineMiles(a: Place, b: Place) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const latLng = (p: Place) => ({ location: { latLng: { latitude: p.lat, longitude: p.lon } } });

export async function routeMiles(a: Place, b: Place): Promise<RouteInfo> {
  try {
    if (GOOGLE) {
      const data = await fetchJson('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration' },
        body: JSON.stringify({ origin: latLng(a), destination: latLng(b), travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', units: 'IMPERIAL' })
      });
      const r = data.routes?.[0];
      if (!r) throw new Error('sin ruta');
      return { miles: r1(r.distanceMeters / 1609.344), minutes: Math.round(parseInt(r.duration, 10) / 60), approx: false };
    }
    const data = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, { headers: { 'User-Agent': UA } });
    const r = data.routes?.[0];
    if (!r) throw new Error('sin ruta');
    return { miles: r1(r.distance / 1609.344), minutes: Math.round(r.duration / 60), approx: false };
  } catch (e) {
    console.error('routeMiles', e);
    // Si el servicio de rutas no responde: línea recta × 1.3 (se marca como aproximado).
    const miles = r1(haversineMiles(a, b) * 1.3);
    return { miles, minutes: Math.round(miles * 2.5 + 5), approx: true };
  }
}
