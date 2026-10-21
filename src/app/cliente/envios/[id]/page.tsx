'use client';

import { use, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell, { BackHeader } from '@/components/AppShell';
import AuthGate from '@/components/AuthGate';
import Icon from '@/components/Icon';
import { Empty, RouteCard, Skeletons, Timeline } from '@/components/orders';
import { errorMessage, useConfirmPaymentMutation, useOrderActionMutation, useOrderQuery, usePayOrderMutation, useSettingsQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { ACTIVE_STATUSES, STATUS } from '@/lib/constants';
import { money } from '@/lib/format';

export default function ClientOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell role="cliente">
      <BackHeader href="/cliente/envios" title="Tu envío" />
      <AuthGate intro="Entra con el número con el que hiciste el pedido.">{() => <ClientOrder id={id} />}</AuthGate>
    </AppShell>
  );
}

function ClientOrder({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const dispatch = useAppDispatch();
  const { data: o, isLoading, error } = useOrderQuery(id, { pollingInterval: 5000, skipPollingIfUnfocused: true });
  const { data: settings } = useSettingsQuery();
  const [act, { isLoading: busy }] = useOrderActionMutation();
  const [pay, { isLoading: opening }] = usePayOrderMutation();
  const [confirm] = useConfirmPaymentMutation();
  const confirmed = useRef(false);

  // Al volver de la página de pago, confirmamos con Stripe (por si el aviso automático tarda).
  useEffect(() => {
    const pago = search.get('pago');
    if (!pago || confirmed.current) return;
    confirmed.current = true;
    if (pago === 'ok') {
      confirm(id).unwrap()
        .then((r) => dispatch(showToast(r.status === 'pendiente' ? '¡Pago recibido! Buscando repartidor…' : 'Estamos confirmando tu pago…')))
        .catch(() => {});
    } else if (pago === 'cancelado') {
      dispatch(showToast('No se completó el pago. Puedes intentarlo de nuevo.'));
    }
    router.replace(`/cliente/envios/${id}`);
  }, [search, id, confirm, dispatch, router]);

  const cancel = async () => {
    if (!o) return;
    const paid = o.payment.method === 'tarjeta' && o.payment.status === 'pagado';
    const fee = o.status === 'asignado' ? Math.min(settings?.cancelFee ?? 0, o.price) : 0;
    const msg = fee > 0
      ? `Un repartidor ya va en camino. Si cancelas se cobra ${money(fee)} (se le paga a él)${paid ? ` y te devolvemos ${money(o.price - fee)}` : ''}. ¿Cancelar?`
      : paid ? '¿Cancelar este pedido? Te devolveremos el total a tu tarjeta.' : '¿Cancelar este pedido?';
    if (!window.confirm(msg)) return;
    try { await act({ id: o.id, action: 'cancel' }).unwrap(); dispatch(showToast(paid ? 'Pedido cancelado. El reembolso puede tardar 5–10 días en verse.' : 'Pedido cancelado')); }
    catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  const payNow = async () => {
    if (!o) return;
    try {
      const r = await pay(o.id).unwrap();
      if (r.checkoutUrl) window.location.assign(r.checkoutUrl);
      else dispatch(showToast('Este pedido ya está pagado'));
    } catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  if (isLoading) return <Skeletons n={3} />;
  if (error || !o) return <Empty icon="box"><p>{errorMessage(error, 'No encontramos este envío.')}</p></Empty>;

  const paymentLabel = o.payment.method === 'tarjeta'
    ? { pendiente: 'Pago con tarjeta pendiente', pagado: 'Pagado con tarjeta', reembolsado: 'Reembolsado a tu tarjeta', reembolso_parcial: `Reembolsado ${money(o.payment.refunded)} a tu tarjeta (se cobró el cargo de cancelación)` }[o.payment.status]
    : o.payment.status === 'pagado' ? 'Pagado en efectivo' : 'Pagas al entregar';

  return (
    <>
      <div className="card dark">
        <span className="eyebrow">Envío #{o.num}</span>
        <h2 style={{ fontSize: 24 }}>{STATUS[o.status].label}</h2>
        {ACTIVE_STATUSES.includes(o.status) && <span className="tiny muted">Se actualiza solo cada pocos segundos.</span>}
        {o.driver && (
          <div className="row small">
            <span className="icon-btn" style={{ background: '#253847', borderColor: '#253847', color: '#fff' }}>{o.driver.name.charAt(0).toUpperCase()}</span>
            <span className="stack" style={{ gap: 2 }}><b>{o.driver.name}</b>
              {o.driver.phone && <a href={`tel:${o.driver.phone}`} style={{ color: '#F2A36F' }}>Llamar al repartidor</a>}</span>
          </div>
        )}
      </div>

      {o.status === 'por_pagar' && (
        <div className="card">
          <div className="row"><Icon name="info" /><b>Falta completar el pago</b></div>
          <p className="small muted">Tu pedido se publica para los repartidores en cuanto se confirme el pago.</p>
          <button className="btn primary block" onClick={payNow} disabled={opening}>{opening ? <span className="spin" /> : `Pagar ${money(o.price)}`}</button>
        </div>
      )}

      {o.status !== 'por_pagar' && <div className="card"><Timeline o={o} /></div>}
      {o.photo && <div className="card"><span className="eyebrow">Foto de entrega</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="photo" src={o.photo} alt="Foto del paquete entregado" /></div>}
      <RouteCard o={o} />
      <div className="card">
        <div className="row between"><span className="muted">Total</span><span className="big" style={{ fontSize: 22 }}>{money(o.price)}</span></div>
        <div className="tiny muted">{paymentLabel}</div>
        {o.declaredValue > 0 && <div className="tiny muted">Valor declarado: {money(o.declaredValue)}</div>}
      </div>
      {(o.status === 'pendiente' || o.status === 'por_pagar' || o.status === 'asignado') && <button className="btn danger block" onClick={cancel} disabled={busy}>Cancelar pedido{o.status === 'asignado' && settings?.cancelFee ? ` (cargo ${money(settings.cancelFee)})` : ''}</button>}
    </>
  );
}
