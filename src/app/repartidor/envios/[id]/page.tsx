'use client';

import { use, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { BackHeader } from '@/components/AppShell';
import DriverGate from '@/components/DriverGate';
import Icon from '@/components/Icon';
import { Empty, RouteCard, Skeletons, Timeline } from '@/components/orders';
import { errorMessage, useOrderActionMutation, useOrderQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { STATUS } from '@/lib/constants';
import { money } from '@/lib/format';
import { shrinkPhoto } from '@/lib/photo';

export default function DriverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AppShell role="repartidor"><DriverGate>{(user) => <DriverOrder id={id} userId={user.id} />}</DriverGate></AppShell>;
}

function DriverOrder({ id, userId }: { id: string; userId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data: o, isLoading, error } = useOrderQuery(id, { pollingInterval: 10000 });
  const [act, { isLoading: busy }] = useOrderActionMutation();
  const mine = o?.driver?.id === userId;

  const run = async (body: Parameters<typeof act>[0], msg: string) => {
    try { await act(body).unwrap(); dispatch(showToast(msg)); return true; }
    catch (e) { dispatch(showToast(errorMessage(e))); return false; }
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !o) return;
    try { await run({ id: o.id, action: 'photo', photo: await shrinkPhoto(file) }, 'Foto guardada'); }
    catch { dispatch(showToast('No se pudo leer la foto')); }
  };

  const deliver = async () => {
    if (!o) return;
    if (!o.photo && !confirm('¿Entregar sin foto?')) return;
    if (await run({ id: o.id, action: 'deliver' }, `¡Entregado! Ganaste ${money(o.driverPay)}`)) router.push('/repartidor');
  };

  if (isLoading) return <Skeletons n={3} />;
  if (error || !o) return <><BackHeader href="/repartidor" title="Envío" /><Empty icon="bike"><p>{errorMessage(error, 'No encontramos este envío.')}</p></Empty></>;

  return (
    <>
      <BackHeader href="/repartidor" title={`Envío #${o.num}`} />
      <div className="card dark"><span className="eyebrow">Ganas en este envío</span><span className="big">{money(o.driverPay)}</span><span className="small">{STATUS[o.status].label}{o.payment.method === 'efectivo' && o.payment.status !== 'pagado' ? ` · Cobra ${money(o.price)} en efectivo al entregar` : ''}</span></div>
      <RouteCard o={o} withNav={mine} />
      {mine && (
        <div className="grid2">
          {o.senderPhone ? <a className="btn" href={`tel:${o.senderPhone}`}><Icon name="phone" size={16} /> Remitente</a> : <span />}
          {o.recPhone ? <a className="btn" href={`tel:${o.recPhone}`}><Icon name="phone" size={16} /> Quien recibe</a> : <span />}
        </div>
      )}
      {mine && o.status === 'asignado' && (
        <button className="btn primary block" disabled={busy} onClick={() => run({ id: o.id, action: 'pickup' }, 'Paquete recogido')}>Ya recogí el paquete</button>
      )}
      {mine && o.status === 'recogido' && (
        <div className="card">
          <span className="eyebrow">Prueba de entrega</span>
          <label className="btn block" htmlFor="ph"><Icon name="camera" size={18} /> {o.photo ? 'Cambiar foto' : 'Tomar foto del paquete entregado'}</label>
          <input id="ph" className="sr-only" type="file" accept="image/*" capture="environment" onChange={onPhoto} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {o.photo && <img className="photo" src={o.photo} alt="Foto de entrega" />}
          <button className="btn primary block" disabled={busy} onClick={deliver}>Marcar como entregado</button>
        </div>
      )}
      <div className="card"><Timeline o={o} /></div>
    </>
  );
}
