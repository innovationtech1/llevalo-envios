import { handleError, ok, parseBody } from '@/server/http';
import { requireAdmin } from '@/server/auth';
import { zonesSchema } from '@/server/schemas';
import { getRepo } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return ok(await getRepo().getZones());
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  const g = await requireAdmin(req);
  if (g.res) return g.res;
  const body = await parseBody(req, zonesSchema);
  if ('res' in body) return body.res;
  try {
    return ok(await getRepo().saveZones(body.data));
  } catch (e) {
    return handleError(e);
  }
}
