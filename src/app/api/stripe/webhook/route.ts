import { NextResponse } from 'next/server';
import { confirmPayment, parseWebhook } from '@/server/payments';
import { getRepo } from '@/server/repo';

export const dynamic = 'force-dynamic';

/** Stripe avisa aquí cuando un pago se completa o la página de pago vence. */
export async function POST(req: Request) {
  const raw = await req.text();
  let event;
  try {
    event = parseWebhook(raw, req.headers.get('stripe-signature'));
  } catch (e) {
    console.error('stripe webhook firma', e);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await confirmPayment(orderId);
    }
    if (event.type === 'charge.dispute.created') {
      // Un cliente reclamó el cobro a su banco: lo marcamos para que lo veas en el panel.
      const d = event.data.object;
      const pi = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id;
      const order = pi ? await getRepo().getOrderByPaymentIntent(pi) : null;
      if (order) await getRepo().patchOrder(order.id, { payment: { ...order.payment, disputed: true } });
    }
    if (event.type === 'checkout.session.expired') {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await getRepo().transition(orderId, ['por_pagar'], 'cancelado');
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('stripe webhook', e);
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
  }
}
