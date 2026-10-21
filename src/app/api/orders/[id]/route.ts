import { fail, handleError, ok, parseBody } from '@/server/http';
import { orderActionSchema } from '@/server/schemas';
import { getRepo } from '@/server/repo';
import { currentUser, requireDriver } from '@/server/auth';
import { canSee, isAdminRequest, publicJob } from '@/server/access';
import { expireCheckout, payDriver, payDriverFee, paymentsMode, refund } from '@/server/payments';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const [o, user, admin] = await Promise.all([getRepo().getOrder(id), currentUser(req), isAdminRequest(req)]);
    if (!o) return fail(404, 'No encontramos este envío');
    const access = canSee(o, user, admin);
    if (!access) return fail(user ? 403 : 401, user ? 'No tienes acceso a este envío' : 'Inicia sesión para ver este envío');
    return ok(access === 'job' ? publicJob(o) : o);
  } catch (e) {
    return handleError(e);
  }
}

/** Máquina de estados: por_pagar → pendiente → asignado → recogido → entregado (o cancelado). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, orderActionSchema);
  if ('res' in body) return body.res;
  const a = body.data;
  const repo = getRepo();
  try {
    const current = await repo.getOrder(id);
    if (!current) return fail(404, 'No encontramos este envío');

    if (a.action === 'cancel') {
      const [user, admin] = await Promise.all([currentUser(req), isAdminRequest(req)]);
      const owner = Boolean(user && current.customerId === user.id);
      if (!owner && !admin) return fail(403, 'No puedes cancelar este envío');
      // Cliente y admin pueden cancelar hasta antes de que se recoja el paquete.
      const allowed: OrderStatus[] = ['por_pagar', 'pendiente', 'asignado'];
      if (!allowed.includes(current.status)) return fail(409, 'El paquete ya se recogió; contáctanos para resolverlo');

      if (current.status === 'por_pagar') await expireCheckout(current);
      const settings = await repo.getSettings();
      // Si el cliente cancela cuando un repartidor ya aceptó, se cobra el cargo de cancelación y se le paga al repartidor.
      const fee = owner && !admin && current.status === 'asignado' ? Math.min(settings.cancelFee, current.price) : 0;
      const payment = await refund(current, current.price - fee);
      const o = await repo.transition(id, allowed, 'cancelado', { payment });
      if (!o) return fail(409, 'El envío cambió de estado. Recarga e intenta de nuevo.');
      if (fee > 0 && o.payment.method === 'tarjeta' && o.driver) {
        const payout = await payDriverFee(o, fee);
        return ok(await repo.patchOrder(id, { payout }));
      }
      return ok(o);
    }

    const g = await requireDriver(req);
    if (g.res) return g.res;
    const me = { id: g.user.id, name: g.user.name || 'Repartidor', phone: g.user.phone };
    const mine = current.driver?.id === me.id;

    switch (a.action) {
      case 'accept': {
        const stored = await repo.getUser(me.id);
        if (!stored?.driverTermsAt) return fail(409, 'Primero acepta el acuerdo de repartidor en "Cobros"');
        if (paymentsMode() === 'stripe' && current.payment.method === 'tarjeta' && !stored.payoutsEnabled) {
          return fail(409, 'Configura tu cuenta de cobros en "Cobros" para poder aceptar envíos');
        }
        const active = await repo.listOrders({ driverId: me.id, status: ['asignado', 'recogido'] });
        if (active.length) return fail(409, 'Termina tu envío actual antes de aceptar otro');
        const o = await repo.transition(id, ['pendiente'], 'asignado', { driver: me });
        return o ? ok(o) : fail(409, 'Otro repartidor ya tomó este envío');
      }
      case 'pickup': {
        if (!mine) return fail(403, 'Este envío lo tiene otro repartidor');
        const o = await repo.transition(id, ['asignado'], 'recogido');
        return o ? ok(o) : fail(409, 'El envío no está listo para recogerse');
      }
      case 'photo': {
        if (!mine) return fail(403, 'Este envío lo tiene otro repartidor');
        if (current.status !== 'recogido') return fail(409, 'Solo se agrega foto al entregar');
        return ok(await repo.patchOrder(id, { photo: a.photo }));
      }
      case 'deliver': {
        if (!mine) return fail(403, 'Este envío lo tiene otro repartidor');
        const cash = current.payment.method === 'efectivo';
        const payment = cash ? { ...current.payment, status: 'pagado' as const } : current.payment;
        const o = await repo.transition(id, ['recogido'], 'entregado', {
          payment, payout: { status: cash ? 'no_aplica' : 'pendiente', amount: current.driverPay }
        });
        if (!o) return fail(409, 'Primero marca el paquete como recogido');
        if (cash) return ok(o);
        // Pago al repartidor en el momento (si falla, el admin puede reintentarlo).
        const settings = await repo.getSettings();
        const payout = await payDriver(o, settings.instantPayouts);
        return ok(await repo.patchOrder(id, { payout }));
      }
    }
  } catch (e) {
    return handleError(e);
  }
}
