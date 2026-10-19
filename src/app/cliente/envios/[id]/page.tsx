'use client';

import { use } from 'react';
import AppShell, { BackHeader } from '@/components/AppShell';
import { Empty, RouteCard, Skeletons, Timeline } from '@/components/orders';
import { errorMessage, useOrderActionMutation, useOrderQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { ACTIVE_STATUSES, STATUS } from '@/lib/constants';
import { money } from '@/lib/format';

export default function ClientOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dispatch = useAppDispatch();
  const phone = useAppSelector((s) => s.session.phone);
  const { data: o, isLoading, error } = useOrderQuery(id, { pollingInterval: 5000, skipPollingIfUnfocused: true });
  const [act, { isLoading: busy }] = useOrderActionMutation();

  const cancel = async () => {
    if (!o || !confirm('¿Cancelar este pedido?')) return;
    try { await act({ id: o.id, action: 'cancel', phone: o.senderPhone || phone }).unwrap(); dispatch(showToast('Pedido cancelado')); }
    catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  return (
    <AppShell role="cliente">
      <BackHeader href="/cliente/envios" title={o ? `Envío #${o.num}` : 'Envío'} />
      {isLoading ? <Skeletons n={3} />
        : error || !o ? <Empty icon="box"><p>{errorMessage(error, 'No encontramos este envío.')}</p></Empty>
        : <>
          <div className="card dark">
            <span className="eyebrow">Estado</span>
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
          <div className="card"><Timeline o={o} /></div>
          {o.photo && <div className="card"><span className="eyebrow">Foto de entrega</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="photo" src={o.photo} alt="Foto del paquete entregado" /></div>}
          <RouteCard o={o} />
          <div className="card">
            <div className="row between"><span className="muted">Total</span><span className="big" style={{ fontSize: 22 }}>{money(o.price)}</span></div>
            <div className="tiny muted">Pago al entregar (el cobro con tarjeta llega en la siguiente fase).</div>
          </div>
          {o.status === 'pendiente' && <button className="btn danger block" onClick={cancel} disabled={busy}>Cancelar pedido</button>}
        </>}
    </AppShell>
  );
}
