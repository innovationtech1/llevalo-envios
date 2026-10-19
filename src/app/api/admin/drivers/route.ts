import { z } from 'zod';
import { fail, handleError, ok, parseBody } from '@/server/http';
import { requireAdmin, toUser } from '@/server/auth';
import { getRepo } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Lista de personas que pidieron ser repartidores (o ya lo son). */
export async function GET(req: Request) {
  const g = await requireAdmin(req);
  if (g.res) return g.res;
  try {
    const list = await getRepo().listUsers(['pendiente', 'aprobado', 'rechazado']);
    return ok(list.map(toUser));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  const g = await requireAdmin(req);
  if (g.res) return g.res;
  const body = await parseBody(req, z.object({ id: z.string().min(1).max(60), status: z.enum(['aprobado', 'rechazado', 'pendiente']) }));
  if ('res' in body) return body.res;
  try {
    const u = await getRepo().updateUser(body.data.id, { driverStatus: body.data.status });
    return u ? ok(toUser(u)) : fail(404, 'No encontramos a esa persona');
  } catch (e) {
    return handleError(e);
  }
}
