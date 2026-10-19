import { fail, handleError, ok, parseBody, requireAdmin } from '@/server/http';
import { orderActionSchema } from '@/server/schemas';
import { getRepo } from '@/server/repo';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const o = await getRepo().getOrder(id);
    return o ? ok(o) : fail(404, 'No encontramos este envío');
  } catch (e) {
    return handleError(e);
  }
}

/** Máquina de estados: pendiente → asignado → recogido → entregado (o cancelado). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await parseBody(req, orderActionSchema);
  if ('res' in body) return body.res;
  const a = body.data;
  const repo = getRepo();
  try {
    const current = await repo.getOrder(id);
    if (!current) return fail(404, 'No encontramos este envío');
    const sameDriver = 'driver' in a && current.driver?.name.toLowerCase() === a.driver.name.toLowerCase();

    switch (a.action) {
      case 'accept': {
        const mine = await repo.listOrders({ driver: a.driver.name, status: ['asignado', 'recogido'] });
        if (mine.length) return fail(409, 'Termina tu envío actual antes de aceptar otro');
        const o = await repo.transition(id, ['pendiente'], 'asignado', { driver: a.driver });
        return o ? ok(o) : fail(409, 'Otro repartidor ya tomó este envío');
      }
      case 'pickup': {
        if (!sameDriver) return fail(403, 'Este envío lo tiene otro repartidor');
        const o = await repo.transition(id, ['asignado'], 'recogido');
        return o ? ok(o) : fail(409, 'El envío no está listo para recogerse');
      }
      case 'photo': {
        if (!sameDriver) return fail(403, 'Este envío lo tiene otro repartidor');
        if (current.status !== 'recogido') return fail(409, 'Solo se agrega foto al entregar');
        return ok(await repo.patchOrder(id, { photo: a.photo }));
      }
      case 'deliver': {
        if (!sameDriver) return fail(403, 'Este envío lo tiene otro repartidor');
        const o = await repo.transition(id, ['recogido'], 'entregado');
        return o ? ok(o) : fail(409, 'Primero marca el paquete como recogido');
      }
      case 'cancel': {
        // El cliente puede cancelar mientras nadie lo ha aceptado; el admin, hasta antes de recogerlo.
        const isOwner = a.phone && a.phone.replace(/\D/g, '') === current.senderPhone.replace(/\D/g, '');
        if (isOwner) {
          const o = await repo.transition(id, ['pendiente'], 'cancelado');
          return o ? ok(o) : fail(409, 'Ya hay un repartidor en camino; contáctanos para cancelar');
        }
        const denied = requireAdmin(req);
        if (denied) return denied;
        const o = await repo.transition(id, ['pendiente', 'asignado'], 'cancelado');
        return o ? ok(o) : fail(409, 'Este envío ya no se puede cancelar');
      }
    }
  } catch (e) {
    return handleError(e);
  }
}
