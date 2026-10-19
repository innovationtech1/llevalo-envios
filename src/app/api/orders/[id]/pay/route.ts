import { fail, handleError, ok } from '@/server/http';
import { getRepo } from '@/server/repo';
import { requireUser } from '@/server/auth';
import { confirmPayment, createCheckout, paymentsMode } from '@/server/payments';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function ownOrder(req: Request, id: string) {
  const g = await requireUser(req);
  if (g.res) return { res: g.res };
  const o = await getRepo().getOrder(id);
  if (!o || o.customerId !== g.user.id) return { res: fail(404, 'No encontramos este envío') };
  return { order: o };
}

/** POST: abre (otra vez) la página de pago de un pedido que no se ha pagado. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (paymentsMode() !== 'stripe') return fail(400, 'El cobro con tarjeta no está activado');
  try {
    const r = await ownOrder(req, id);
    if (r.res) return r.res;
    const fresh = await confirmPayment(id); // por si ya se pagó
    if (fresh && fresh.status !== 'por_pagar') return ok({ order: fresh });
    return ok({ checkoutUrl: await createCheckout(r.order, new URL(req.url).origin) });
  } catch (e) {
    return handleError(e);
  }
}

/** GET: confirma con Stripe si el pago ya se completó (al volver de la página de pago). */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const r = await ownOrder(req, id);
    if (r.res) return r.res;
    if (paymentsMode() !== 'stripe') return ok(r.order);
    return ok(await confirmPayment(id));
  } catch (e) {
    return handleError(e);
  }
}
