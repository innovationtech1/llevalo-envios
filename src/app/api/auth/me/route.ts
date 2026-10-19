import { z } from 'zod';
import { handleError, ok, parseBody } from '@/server/http';
import { currentUser, requireUser, toUser } from '@/server/auth';
import { getRepo } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    return ok(await currentUser(req)); // null si no hay sesión
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1, 'Escribe tu nombre').max(80).optional(),
  applyDriver: z.literal(true).optional()
});

export async function PATCH(req: Request) {
  const g = await requireUser(req);
  if (g.res) return g.res;
  const body = await parseBody(req, patchSchema);
  if ('res' in body) return body.res;
  try {
    const patch: { name?: string; driverStatus?: 'pendiente' } = {};
    if (body.data.name) patch.name = body.data.name;
    if (body.data.applyDriver && (g.user.driverStatus === 'ninguno' || g.user.driverStatus === 'rechazado')) patch.driverStatus = 'pendiente';
    const u = await getRepo().updateUser(g.user.id, patch);
    return ok(u ? toUser(u) : null);
  } catch (e) {
    return handleError(e);
  }
}
