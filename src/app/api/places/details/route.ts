import { fail, ok } from '@/server/http';
import { placeDetails } from '@/server/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const id = (p.get('id') || '').trim();
  const session = (p.get('session') || '').slice(0, 64);
  if (!/^[\w-]{10,300}$/.test(id)) return fail(422, 'Dirección inválida');
  try {
    return ok(await placeDetails(id, session));
  } catch (e) {
    console.error('placeDetails', e);
    return fail(502, 'No pudimos confirmar esa dirección. Intenta de nuevo.');
  }
}
