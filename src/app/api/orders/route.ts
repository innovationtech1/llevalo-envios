import { fail, handleError, ok, parseBody, requireAdmin } from '@/server/http';
import { createOrderSchema } from '@/server/schemas';
import { buildQuote } from '@/server/quote';
import { getRepo } from '@/server/repo';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID: OrderStatus[] = ['pendiente', 'asignado', 'recogido', 'entregado', 'cancelado'];

// GET /api/orders?phone=…  (cliente)  |  ?status=pendiente / ?driver=…  (repartidor)  |  sin filtros (admin)
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const phone = p.get('phone') || undefined;
  const driver = p.get('driver') || undefined;
  const status = p.get('status')?.split(',').filter((s): s is OrderStatus => VALID.includes(s as OrderStatus));
  if (!phone && !driver && !status?.length) {
    const denied = requireAdmin(req);
    if (denied) return denied;
  }
  if (phone && phone.replace(/\D/g, '').length < 7) return fail(422, 'Teléfono inválido');
  try {
    // Los datos de contacto del remitente no se envían a la lista pública de trabajos disponibles.
    const list = await getRepo().listOrders({ phone, driver, status: status?.length ? status : undefined });
    const publicJobs = !phone && !driver && status?.length === 1 && status[0] === 'pendiente';
    return ok(publicJobs ? list.map((o) => ({ ...o, senderPhone: '', recPhone: '', photo: null })) : list);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  const body = await parseBody(req, createOrderSchema);
  if ('res' in body) return body.res;
  const o = body.data;
  try {
    // El precio lo decide el servidor, nunca el celular.
    const { route, quote, problems } = await buildQuote(o.pickup, o.dropoff, o.size);
    if (problems.length) return fail(422, problems[0], problems);
    const order = await getRepo().createOrder({
      pickup: o.pickup, dropoff: o.dropoff, size: o.size, when: o.when,
      scheduledAt: o.when === 'prog' ? o.scheduledAt : '',
      senderName: o.senderName, senderPhone: o.senderPhone,
      recName: o.recName, recPhone: o.recPhone, notes: o.notes,
      miles: route.miles, minutes: route.minutes, price: quote.total, driverPay: quote.driverPay
    });
    return ok(order, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    await getRepo().clearOrders();
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
