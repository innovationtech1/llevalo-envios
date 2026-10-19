import 'server-only';
import Stripe from 'stripe';
import type { Order } from '@/lib/types';
import { getRepo } from './repo';

/**
 * Cobro con tarjeta usando Stripe Checkout.
 * Sin STRIPE_SECRET_KEY, los pedidos se pagan al entregar (efectivo) como antes.
 */
const KEY = process.env.STRIPE_SECRET_KEY;
let client: Stripe | null = null;
const stripe = () => (client ??= new Stripe(KEY!));

export const paymentsMode = (): 'stripe' | 'efectivo' => (KEY ? 'stripe' : 'efectivo');

/** Crea la página de pago de Stripe para un pedido. Vence en 31 minutos. */
export async function createCheckout(order: Order, origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    locale: 'es',
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    payment_intent_data: { metadata: { orderId: order.id }, description: `Llévalo envío #${order.num}` },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(order.price * 100),
        product_data: { name: `Envío #${order.num} · ${order.miles} mi`, description: `${order.pickup.label} → ${order.dropoff.label}`.slice(0, 300) }
      }
    }],
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: `${origin}/cliente/envios/${order.id}?pago=ok`,
    cancel_url: `${origin}/cliente/envios/${order.id}?pago=cancelado`
  });
  await getRepo().patchOrder(order.id, { payment: { ...order.payment, sessionId: session.id } });
  return session.url!;
}

/**
 * Revisa con Stripe si el pedido ya se pagó y, si es así, lo publica para los repartidores.
 * Se usa al volver de la página de pago y desde el webhook (lo que llegue primero).
 */
export async function confirmPayment(orderId: string): Promise<Order | null> {
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order) return null;
  if (order.status !== 'por_pagar' || !order.payment.sessionId) return order;
  const s = await stripe().checkout.sessions.retrieve(order.payment.sessionId);
  if (s.payment_status !== 'paid') return order;
  const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
  return (await repo.transition(orderId, ['por_pagar'], 'pendiente', {
    payment: { ...order.payment, status: 'pagado', paymentIntent: pi }
  })) ?? (await repo.getOrder(orderId));
}

/** Devuelve el dinero de un pedido pagado con tarjeta. */
export async function refundIfPaid(order: Order): Promise<Order['payment']> {
  if (order.payment.method !== 'tarjeta' || order.payment.status !== 'pagado' || !order.payment.paymentIntent) return order.payment;
  await stripe().refunds.create({ payment_intent: order.payment.paymentIntent, metadata: { orderId: order.id } });
  return { ...order.payment, status: 'reembolsado' };
}

/** Cancela la página de pago si el cliente cancela antes de pagar. */
export async function expireCheckout(order: Order) {
  if (!order.payment.sessionId || order.payment.status !== 'pendiente') return;
  try { await stripe().checkout.sessions.expire(order.payment.sessionId); } catch { /* ya vencida o pagada */ }
}

export function parseWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error('Webhook sin configurar');
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}
