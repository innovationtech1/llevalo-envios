import { fail, handleError, ok, parseBody } from '@/server/http';
import { createOrderSchema } from '@/server/schemas';
import { buildQuote } from '@/server/quote';
import { getRepo } from '@/server/repo';
import { requireAdmin, requireDriver, requireUser } from '@/server/auth';
import { publicJob } from '@/server/access';
import { createCheckout, paymentsMode } from '@/server/payments';
import { TERMS_VERSION } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders?scope=
 *   mine   → los envíos del cliente con sesión
 *   jobs   → envíos disponibles para repartidores aprobados (sin datos de contacto)
 *   driver → los envíos que tomó el repartidor con sesión
 *   all    → todos (administrador)
 */
export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get('scope') || 'mine';
  const repo = getRepo();
  try {
    if (scope === 'jobs') {
      const g = await requireDriver(req);
      if (g.res) return g.res;
      return ok((await repo.listOrders({ status: ['pendiente'] })).map(publicJob));
    }
    if (scope === 'driver') {
      const g = await requireDriver(req);
      if (g.res) return g.res;
      return ok(await repo.listOrders({ driverId: g.user.id }));
    }
    if (scope === 'all') {
      const g = await requireAdmin(req);
      if (g.res) return g.res;
      return ok(await repo.listOrders({}));
    }
    const g = await requireUser(req);
    if (g.res) return g.res;
    return ok(await repo.listOrders({ customerId: g.user.id }));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const g = await requireUser(req);
  if (g.res) return g.res;
  const body = await parseBody(req, createOrderSchema);
  if ('res' in body) return body.res;
  const o = body.data;
  const repo = getRepo();
  try {
    // El precio lo decide el servidor, nunca el celular.
    const { route, quote, problems } = await buildQuote(o.pickup, o.dropoff, o.size);
    if (problems.length) return fail(422, problems[0], problems);
    if (!g.user.name) await repo.updateUser(g.user.id, { name: o.senderName });

    const card = paymentsMode() === 'stripe';
    const order = await repo.createOrder({
      customerId: g.user.id,
      pickup: o.pickup, dropoff: o.dropoff, size: o.size, when: o.when,
      scheduledAt: o.when === 'prog' ? o.scheduledAt : '',
      senderName: o.senderName, senderPhone: g.user.phone,
      recName: o.recName, recPhone: o.recPhone, notes: o.notes,
      miles: route.miles, minutes: route.minutes, price: quote.total, driverPay: quote.driverPay,
      payment: { method: card ? 'tarjeta' : 'efectivo', status: 'pendiente' },
      declaredValue: o.declaredValue, termsVersion: TERMS_VERSION, termsAt: Date.now()
    }, card ? 'por_pagar' : 'pendiente');

    if (!card) return ok({ order }, { status: 201 });
    try {
      const checkoutUrl = await createCheckout(order, new URL(req.url).origin);
      return ok({ order, checkoutUrl }, { status: 201 });
    } catch (e) {
      console.error('stripe checkout', e);
      return ok({ order, error: 'El pedido se guardó, pero no pudimos abrir el pago. Intenta pagar desde el envío.' }, { status: 201 });
    }
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  const g = await requireAdmin(req);
  if (g.res) return g.res;
  if (!getRepo().demo) return fail(403, 'Solo se pueden borrar pedidos en modo demo');
  try {
    await getRepo().clearOrders();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
