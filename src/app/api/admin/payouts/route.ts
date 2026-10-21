import { z } from 'zod';
import { fail, handleError, ok, parseBody } from '@/server/http';
import { requireAdmin } from '@/server/auth';
import { getRepo } from '@/server/repo';
import { payDriver } from '@/server/payments';

export const dynamic = 'force-dynamic';

/** Reintenta el pago a un repartidor cuando falló (por ejemplo, si aún no terminaba su cuenta de cobros). */
export async function POST(req: Request) {
  const g = await requireAdmin(req);
  if (g.res) return g.res;
  const body = await parseBody(req, z.object({ orderId: z.string().min(1).max(60) }));
  if ('res' in body) return body.res;
  const repo = getRepo();
  try {
    const order = await repo.getOrder(body.data.orderId);
    if (!order) return fail(404, 'No encontramos este envío');
    if (order.status !== 'entregado') return fail(409, 'Solo se paga al repartidor cuando el envío se entregó');
    if (order.payout && order.payout.status !== 'fallido') return fail(409, 'Este envío ya se le pagó al repartidor');
    const settings = await repo.getSettings();
    const payout = await payDriver(order, settings.instantPayouts);
    return ok(await repo.patchOrder(order.id, { payout }));
  } catch (e) {
    return handleError(e);
  }
}
