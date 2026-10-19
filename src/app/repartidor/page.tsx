'use client';

import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import DriverGate from '@/components/DriverGate';
import Icon from '@/components/Icon';
import { Empty, OrderCard, Skeletons } from '@/components/orders';
import { errorMessage, useOrderActionMutation, useOrdersQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setOnline } from '@/store/sessionSlice';
import { showToast } from '@/store/uiSlice';
import { sizeLabel } from '@/lib/constants';
import { isToday, money } from '@/lib/format';
import type { User } from '@/lib/types';

export default function DriverHome() {
  return <AppShell role="repartidor"><DriverGate>{(user) => <Jobs user={user} />}</DriverGate></AppShell>;
}

function Jobs({ user }: { user: User }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const online = useAppSelector((s) => s.session.online);
  const { data: mine } = useOrdersQuery('driver', { pollingInterval: 10000 });
  const { data: avail, isLoading, error } = useOrdersQuery('jobs', { skip: !online, pollingInterval: 5000, skipPollingIfUnfocused: true });
  const [act, { isLoading: busy }] = useOrderActionMutation();

  const active = (mine ?? []).filter((o) => o.status === 'asignado' || o.status === 'recogido');
  const doneToday = (mine ?? []).filter((o) => o.status === 'entregado' && isToday(o.history[o.history.length - 1].at));
  const earned = doneToday.reduce((a, o) => a + o.driverPay, 0);

  const accept = async (id: string) => {
    try {
      await act({ id, action: 'accept' }).unwrap();
      dispatch(showToast('Envío aceptado. Ve a recogerlo.'));
      router.push(`/repartidor/envios/${id}`);
    } catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  return (
    <>
      <div className="row between">
        <div className="stack" style={{ gap: 2 }}><span className="small muted">Modo repartidor</span><h1 style={{ fontSize: 26 }}>Hola, {user.name.split(' ')[0]}</h1></div>
        <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
          {online ? 'En línea' : 'Desconectado'}
          <span className="switch"><input type="checkbox" checked={online} onChange={(e) => dispatch(setOnline(e.target.checked))} aria-label="Estar en línea" /><span /></span>
        </label>
      </div>
      <div className="grid2">
        <div className="card dark" style={{ gap: 4 }}><span className="small muted">Ganado hoy</span><span className="big" style={{ fontSize: 24 }}>{money(earned)}</span></div>
        <div className="card dark" style={{ gap: 4 }}><span className="small muted">Entregas hoy</span><span className="big" style={{ fontSize: 24 }}>{doneToday.length}</span></div>
      </div>

      {active.length > 0 && <>
        <div className="eyebrow">En curso</div>
        <div className="list">{active.map((o) => <OrderCard key={o.id} o={o} href={`/repartidor/envios/${o.id}`} right={<b>Ganas {money(o.driverPay)}</b>} />)}</div>
      </>}

      <div className="row between"><h2>Envíos disponibles</h2><span className="small muted">{online ? avail?.length ?? '' : ''}</span></div>
      {!online ? <div className="notice info"><Icon name="info" size={18} /><span>Activa &quot;En línea&quot; para ver y aceptar envíos.</span></div>
        : isLoading ? <Skeletons />
        : error ? <div className="err">{errorMessage(error)}</div>
        : avail?.length ? (
          <div className="list">{avail.map((o) => (
            <div className="card" key={o.id}>
              <div className="row between">
                <span className="badge b-acc">{o.payment.method === 'tarjeta' ? 'Pagado con tarjeta' : 'Cobrar al entregar'}</span>
                <b className="big" style={{ fontSize: 20 }}>{money(o.driverPay)}</b>
              </div>
              <div className="stack small">
                <div className="row" style={{ gap: 8 }}><span className="dot" />{o.pickup.label}</div>
                <div className="row" style={{ gap: 8 }}><span className="sq" />{o.dropoff.label}</div>
              </div>
              <div className="row between">
                <span className="small muted">{o.miles} mi · {sizeLabel(o.size)}{o.when === 'prog' ? ' · Programado' : ''}</span>
                <button className="btn ink sm" onClick={() => accept(o.id)} disabled={busy || active.length > 0} title={active.length ? 'Termina tu envío actual primero' : undefined}>Aceptar</button>
              </div>
            </div>
          ))}</div>
        ) : <Empty icon="bike"><p>No hay envíos disponibles ahora mismo.</p></Empty>}
    </>
  );
}
