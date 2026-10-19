import { fail, ok } from '@/server/http';
import { geocode } from '@/server/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 4) return fail(422, 'Escribe una dirección más completa');
  if (q.length > 200) return fail(422, 'La dirección es demasiado larga');
  try {
    return ok(await geocode(q));
  } catch (e) {
    console.error('geocode', e);
    return fail(502, 'No pudimos buscar la dirección. Intenta de nuevo.');
  }
}
