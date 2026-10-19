import 'server-only';
import type { Place, RouteInfo } from '@/lib/types';

/**
 * Direcciones y millas, del lado del servidor.
 * Con GOOGLE_MAPS_API_KEY usa Google Maps; sin ella, OpenStreetMap (Nominatim + OSRM).
 */
const GOOGLE = process.env.GOOGLE_MAPS_API_KEY;
const UA = `Llevalo/0.2 (${process.env.CONTACT_EMAIL || 'contacto@llevalo.app'})`;
// Sesgo hacia San Antonio, TX.
const SA = { lat: 29.4241, lon: -98.4936 };

export const mapsProvider = (): 'google' | 'osm' => (GOOGLE ? 'google' : 'osm');

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ---------- búsqueda de direcciones ---------- */
export async function geocode(q: string): Promise<Place[]> {
  return GOOGLE ? geocodeGoogle(q) : geocodeOsm(q);
}

async function geocodeGoogle(q: string): Promise<Place[]> {
  const params = new URLSearchParams({ address: q, components: 'country:US', bounds: '29.1,-99.2|29.9,-97.9', language: 'es', key: GOOGLE! });
  const data = await fetchJson('https://maps.googleapis.com/maps/api/geocode/json?' + params);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error('Google: ' + data.status);
  return (data.results || []).slice(0, 5).map((r: { formatted_address: string; geometry: { location: { lat: number; lng: number } }; address_components: { types: string[]; short_name: string }[] }) => ({
    label: r.formatted_address.replace(/, USA$/, ''),
    lat: r.geometry.location.lat,
    lon: r.geometry.location.lng,
    zip: r.address_components.find((c) => c.types.includes('postal_code'))?.short_name ?? ''
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
  return list.map((r) => ({
    label: osmLabel(r),
    lat: Number(r.lat),
    lon: Number(r.lon),
    zip: r.address?.postcode ? String(r.address.postcode).slice(0, 5) : ''
  }));
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

export async function routeMiles(a: Place, b: Place): Promise<RouteInfo> {
  try {
    if (GOOGLE) {
      const params = new URLSearchParams({ origins: `${a.lat},${a.lon}`, destinations: `${b.lat},${b.lon}`, units: 'imperial', mode: 'driving', key: GOOGLE });
      const data = await fetchJson('https://maps.googleapis.com/maps/api/distancematrix/json?' + params);
      const el = data.rows?.[0]?.elements?.[0];
      if (!el || el.status !== 'OK') throw new Error('sin ruta');
      return { miles: r1(el.distance.value / 1609.344), minutes: Math.round(el.duration.value / 60), approx: false };
    }
    const data = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`, { headers: { 'User-Agent': UA } });
    const r = data.routes?.[0];
    if (!r) throw new Error('sin ruta');
    return { miles: r1(r.distance / 1609.344), minutes: Math.round(r.duration / 60), approx: false };
  } catch {
    // Si el servicio de rutas no responde: línea recta × 1.3 (se marca como aproximado).
    const miles = r1(haversineMiles(a, b) * 1.3);
    return { miles, minutes: Math.round(miles * 2.5 + 5), approx: true };
  }
}

export const SAN_ANTONIO = SA;
