import { fail, ok } from '@/server/http';
import { autocomplete } from '@/server/geo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const q = (p.get('q') || '').trim();
  const session = (p.get('session') || '').slice(0, 64);
  if (q.length < 3) return ok([]);
  if (q.length > 200) return fail(422, 'La dirección es demasiado larga');
  try {
    return ok(await autocomplete(q, session));
  } catch (e) {
    console.error('autocomplete', e);
    return fail(502, 'No pudimos buscar direcciones. Intenta de nuevo.');
  }
}
