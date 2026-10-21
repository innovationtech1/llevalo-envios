import 'server-only';
import Stripe from 'stripe';
import type { DriverPayout, DriverPayoutsInfo, Order, Payment } from '@/lib/types';
import { getRepo, type StoredUser } from './repo';

/**
 * Pagos con Stripe.
 *  - Cobro al cliente: Stripe Checkout (los datos de tarjeta nunca pasan por la app).
 *  - Pago al repartidor: Stripe Connect (cuentas Express). Stripe verifica la identidad,
 *    guarda los datos fiscales, prepara los 1099 y mueve el dinero con sus licencias.
 *    Al entregar: transferencia a la cuenta del repartidor + pago instantáneo a su débito.
 * Sin STRIPE_SECRET_KEY, los pedidos se pagan en efectivo al entregar (modo prueba).
 */
const KEY = process.env.STRIPE_SECRET_KEY;
let client: Stripe | null = null;
const stripe = () => (client ??= new Stripe(KEY!));
const cents = (n: number) => Math.round(n * 100);

export const paymentsMode = (): 'stripe' | 'efectivo' => (KEY ? 'stripe' : 'efectivo');

/* ============ cobro al cliente ============ */

/** Crea la página de pago de Stripe para un pedido. Vence en 31 minutos. */
export async function createCheckout(order: Order, origin: string): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    locale: 'es',
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    allowed_payment_method_types: ['card', 'link'], // tarjeta (y Link): el dinero queda disponible al momento para pagar al repartidor
    payment_intent_data: { metadata: { orderId: order.id }, description: `Llévalo envío #${order.num}`, transfer_group: order.id },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents(order.price),
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

/** Revisa con Stripe si el pedido ya se pagó y, si es así, lo publica para los repartidores. */
export async function confirmPayment(orderId: string): Promise<Order | null> {
  const repo = getRepo();
  const order = await repo.getOrder(orderId);
  if (!order) return null;
  if (order.status !== 'por_pagar' || !order.payment.sessionId) return order;
  const s = await stripe().checkout.sessions.retrieve(order.payment.sessionId, { expand: ['payment_intent'] });
  if (s.payment_status !== 'paid') return order;
  const pi = s.payment_intent as Stripe.PaymentIntent | null;
  const chargeId = pi ? (typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id) : undefined;
  return (await repo.transition(orderId, ['por_pagar'], 'pendiente', {
    payment: { ...order.payment, status: 'pagado', paymentIntent: pi?.id, chargeId }
  })) ?? (await repo.getOrder(orderId));
}

/** Reembolsa todo o una parte (por ejemplo, todo menos el cargo de cancelación). */
export async function refund(order: Order, amount = order.price): Promise<Payment> {
  const p = order.payment;
  if (p.method !== 'tarjeta' || p.status !== 'pagado' || !p.paymentIntent || amount <= 0) return p;
  const value = Math.min(amount, order.price);
  await stripe().refunds.create({ payment_intent: p.paymentIntent, amount: cents(value), metadata: { orderId: order.id } }, { idempotencyKey: `refund-${order.id}` });
  return { ...p, status: value >= order.price ? 'reembolsado' : 'reembolso_parcial', refunded: value };
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

/* ============ cuentas de cobro de repartidores (Stripe Connect Express) ============ */

/** Crea (una vez) la cuenta Express del repartidor. Stripe pide sus datos en su propia página. */
export async function ensureConnectAccount(user: StoredUser): Promise<string> {
  if (user.stripeAccountId) return user.stripeAccountId;
  const account = await stripe().accounts.create({
    type: 'express',
    country: 'US',
    business_type: 'individual',
    capabilities: { transfers: { requested: true } },
    business_profile: { mcc: '4215', product_description: 'Repartidor independiente en la plataforma Llévalo (mensajería local)' },
    individual: { phone: user.phone, first_name: user.name.split(' ')[0] || undefined },
    settings: { payouts: { schedule: { interval: 'daily' } } },
    metadata: { userId: user.id }
  }, { idempotencyKey: `acct-${user.id}` });
  await getRepo().updateUser(user.id, { stripeAccountId: account.id });
  return account.id;
}

export async function onboardingLink(accountId: string, origin: string) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: `${origin}/repartidor/cobros?refrescar=1`,
    return_url: `${origin}/repartidor/cobros?listo=1`
  });
  return link.url;
}

export async function dashboardLink(accountId: string) {
  return (await stripe().accounts.createLoginLink(accountId)).url;
}

/** Lee de Stripe si la cuenta ya puede recibir dinero y lo guarda. */
export async function syncAccount(user: StoredUser): Promise<boolean> {
  if (!user.stripeAccountId) return false;
  const a = await stripe().accounts.retrieve(user.stripeAccountId);
  const enabled = Boolean(a.payouts_enabled && a.capabilities?.transfers === 'active');
  if (enabled !== user.payoutsEnabled) await getRepo().updateUser(user.id, { payoutsEnabled: enabled });
  return enabled;
}

export async function payoutsInfo(user: StoredUser): Promise<DriverPayoutsInfo> {
  const base: DriverPayoutsInfo = {
    enabled: paymentsMode() === 'stripe', hasAccount: Boolean(user.stripeAccountId), payoutsEnabled: user.payoutsEnabled,
    termsAccepted: Boolean(user.driverTermsAt), balance: null, instantCapable: false
  };
  if (!base.enabled || !user.stripeAccountId) return base;
  base.payoutsEnabled = await syncAccount(user);
  if (!base.payoutsEnabled) return base;
  const opts = { stripeAccount: user.stripeAccountId };
  const [bal, ext] = await Promise.all([
    stripe().balance.retrieve({}, opts),
    stripe().accounts.listExternalAccounts(user.stripeAccountId, { limit: 10 })
  ]);
  const sum = (arr?: { amount: number; currency: string }[]) => (arr ?? []).filter((x) => x.currency === 'usd').reduce((a, x) => a + x.amount, 0) / 100;
  base.balance = { available: sum(bal.available), pending: sum(bal.pending), instant: sum(bal.instant_available) };
  base.instantCapable = ext.data.some((e) => (e as { available_payout_methods?: string[] }).available_payout_methods?.includes('instant'));
  return base;
}

/* ============ pago al repartidor ============ */

/**
 * Paga al repartidor su parte de un envío entregado:
 * 1) transferencia desde el cobro del cliente a su cuenta (source_transaction = el cargo),
 * 2) si está activado, pago instantáneo a su tarjeta de débito (~30 min, Stripe cobra 1%).
 * Si el pago instantáneo no se puede, el dinero le llega en el depósito diario normal.
 */
export async function payDriver(order: Order, instant: boolean): Promise<DriverPayout> {
  const amount = order.driverPay;
  if (order.payment.method !== 'tarjeta' || !order.driver) return { status: 'no_aplica', amount };
  const driver = await getRepo().getUser(order.driver.id);
  if (!driver?.stripeAccountId) return { status: 'fallido', amount, error: 'El repartidor no tiene cuenta de cobros', at: Date.now() };

  let transferId = order.payout?.transferId;
  try {
    if (!transferId) {
      const chargeId = order.payment.chargeId ?? (await chargeFor(order));
      const t = await stripe().transfers.create({
        amount: cents(amount), currency: 'usd', destination: driver.stripeAccountId,
        source_transaction: chargeId, transfer_group: order.id,
        description: `Envío #${order.num}`, metadata: { orderId: order.id }
      }, { idempotencyKey: `transfer-${order.id}` });
      transferId = t.id;
    }
  } catch (e) {
    return { status: 'fallido', amount, error: stripeMessage(e), at: Date.now() };
  }

  if (!instant) return { status: 'estandar', amount, transferId, at: Date.now() };
  try {
    const opts = { stripeAccount: driver.stripeAccountId };
    const bal = await stripe().balance.retrieve({}, opts);
    const ready = (bal.instant_available ?? []).find((b) => b.currency === 'usd')?.amount ?? 0;
    const value = Math.min(ready, cents(amount));
    if (value < 50) return { status: 'estandar', amount, transferId, at: Date.now() }; // mínimo de Stripe: $0.50
    const p = await stripe().payouts.create(
      { amount: value, currency: 'usd', method: 'instant', description: `Llévalo envío #${order.num}`, metadata: { orderId: order.id } },
      { ...opts, idempotencyKey: `payout-${order.id}` }
    );
    return { status: 'instantaneo', amount, transferId, payoutId: p.id, at: Date.now() };
  } catch (e) {
    // Sin tarjeta compatible o límite diario: le llega en el depósito normal.
    return { status: 'estandar', amount, transferId, error: stripeMessage(e), at: Date.now() };
  }
}

/** Paga al repartidor una compensación (por ejemplo, el cargo de cancelación). */
export async function payDriverFee(order: Order, amount: number): Promise<DriverPayout> {
  return payDriver({ ...order, driverPay: amount, payout: undefined }, false);
}

async function chargeFor(order: Order) {
  const pi = await stripe().paymentIntents.retrieve(order.payment.paymentIntent!);
  const id = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  if (!id) throw new Error('No encontramos el cobro de este pedido');
  return id;
}

function stripeMessage(e: unknown) {
  const m = (e as { message?: string })?.message || 'Error de Stripe';
  console.error('stripe', m);
  return m.slice(0, 200);
}
