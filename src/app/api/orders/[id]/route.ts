import { fail, handleError, ok, parseBody } from '@/server/http';
import { orderActionSchema } from '@/server/schemas';
import { getRepo } from '@/server/repo';
import { currentUser, requireDriver } from '@/server/auth';
import { canSee, isAdminRequest, publicJob } from '@/server/access';
import { expireCheckout, refundIfPaid } from '@/server/payments';
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
      const owner = user && current.customerId === user.id;
      if (!owner && !admin) return fail(403, 'No puedes cancelar este envío');
      // El cliente cancela mientras nadie lo ha aceptado; el admin, hasta antes de recogerlo.
      const allowed: OrderStatus[] = admin ? ['por_pagar', 'pendiente', 'asignado'] : ['por_pagar', 'pendiente'];
      if (!allowed.includes(current.status)) {
        return fail(409, owner && !admin ? 'Ya hay un repartidor en camino; contáctanos para cancelar' : 'Este envío ya no se puede cancelar');
      }
      if (current.status === 'por_pagar') await expireCheckout(current);
      const payment = await refundIfPaid(current);
      const o = await repo.transition(id, allowed, 'cancelado', { payment });
      return o ? ok(o) : fail(409, 'El envío cambió de estado. Recarga e intenta de nuevo.');
    }

    const g = await requireDriver(req);
    if (g.res) return g.res;
    const me = { id: g.user.id, name: g.user.name || 'Repartidor', phone: g.user.phone };
    const mine = current.driver?.id === me.id;

    switch (a.action) {
      case 'accept': {
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
        const payment = current.payment.method === 'efectivo' ? { ...current.payment, status: 'pagado' as const } : current.payment;
        const o = await repo.transition(id, ['recogido'], 'entregado', { payment });
        return o ? ok(o) : fail(409, 'Primero marca el paquete como recogido');
      }
    }
  } catch (e) {
    return handleError(e);
  }
}
