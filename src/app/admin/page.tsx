'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import AdminGate from '@/components/AdminGate';
import Icon from '@/components/Icon';
import { Skeletons, StatusBadge } from '@/components/orders';
import { errorMessage, useClearOrdersMutation, useInfoQuery, useOrderActionMutation, useOrdersQuery, useRetryPayoutMutation, useSettingsQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { ACTIVE_STATUSES } from '@/lib/constants';
import { fmtDate, isToday, money } from '@/lib/format';

export default function AdminPage() {
  return <AppShell role="admin" wide><AdminGate><Summary /></AdminGate></AppShell>;
}

const PAYOUT_TEXT = {
  no_aplica: 'Cobró en efectivo', pendiente: 'Procesando…', transferido: 'Transferido', instantaneo: 'Pagado al instante',
  estandar: 'En depósito diario', fallido: 'Falló'
} as const;

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <div className="card" style={{ gap: 6 }}><span className="small muted">{label}</span><span className="big" style={{ fontSize: 26 }}>{value}</span></div>;
}

function Summary() {
  const dispatch = useAppDispatch();
  const { data: orders, isLoading, error } = useOrdersQuery('all', { pollingInterval: 10000, skipPollingIfUnfocused: true });
  const { data: settings } = useSettingsQuery();
  const { data: info } = useInfoQuery();
  const [act] = useOrderActionMutation();
  const [clear] = useClearOrdersMutation();
  const [retry, { isLoading: retrying }] = useRetryPayoutMutation();

  const list = orders ?? [];
  const today = list.filter((o) => isToday(o.createdAt));
  const delivered = list.filter((o) => o.status === 'entregado' && isToday(o.history[o.history.length - 1].at));
  const revenue = delivered.reduce((a, o) => a + o.price, 0);
  const pay = delivered.reduce((a, o) => a + o.driverPay, 0);
  const disputed = list.filter((o) => o.payment.disputed);
  const failed = list.filter((o) => o.payout?.status === 'fallido');
  const retryPay = async (id: string) => {
    try {
      const r = await retry(id).unwrap();
      dispatch(showToast(r.payout?.status === 'fallido' ? `Sigue fallando: ${r.payout.error ?? ''}` : 'Pago enviado al repartidor'));
    } catch (e) { dispatch(showToast(errorMessage(e))); }
  };
  const visible = list.filter((o) => o.status !== 'por_pagar' || Date.now() - o.createdAt < 60 * 60_000);

  const cancel = async (id: string) => {
    if (!confirm('¿Cancelar este pedido? Si ya se pagó, se le reembolsa el total al cliente.')) return;
    try { await act({ id, action: 'cancel' }).unwrap(); dispatch(showToast('Pedido cancelado')); }
    catch (e) { dispatch(showToast(errorMessage(e))); }
  };
  const reset = async () => {
    if (!confirm('Se borrarán TODOS los pedidos. Las tarifas y zonas se quedan.')) return;
    try { await clear().unwrap(); dispatch(showToast('Pedidos borrados')); } catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  return (
    <>
      <h1>Resumen</h1>
      {settings && !settings.edited && (
        <div className="notice"><Icon name="info" size={18} /><span>Estás usando <b>tarifas de ejemplo</b>. Ajústalas en <Link href="/admin/tarifas">Tarifas</Link> antes de cobrar a clientes reales.</span></div>
      )}
      {disputed.length > 0 && (
        <div className="notice" style={{ background: '#FBE4E1', color: 'var(--danger)' }}><Icon name="info" size={18} />
          <span><b>{disputed.length} cobro(s) en disputa</b> (#{disputed.map((o) => o.num).join(', #')}). Respóndelos en tu panel de Stripe → Disputas con la foto y las horas de entrega.</span></div>
      )}
      {failed.length > 0 && (
        <div className="notice"><Icon name="info" size={18} />
          <span><b>{failed.length} pago(s) a repartidores fallaron.</b> Usa &quot;Reintentar pago&quot; en la tabla cuando el repartidor termine su cuenta de cobros.</span></div>
      )}
      {info && (!info.adminConfigured || info.sms === 'prueba' || info.payments === 'efectivo' || info.maps === 'osm' || !info.legalConfigured) && (
        <div className="card">
          <h3>Pendiente de configurar</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!info.adminConfigured && <li><b>ADMIN_PHONES</b>: tu número, para que solo tú entres a este panel.</li>}
            {info.maps === 'osm' && <li><b>GOOGLE_MAPS_API_KEY</b>: direcciones con autocompletar y millas de Google.</li>}
            {info.payments === 'efectivo' && <li><b>STRIPE_SECRET_KEY</b>: cobro con tarjeta (hoy se paga en efectivo al entregar).</li>}
            {info.sms === 'prueba' && <li><b>Twilio</b>: códigos reales por mensaje (hoy el código de prueba es 123456).</li>}
            {!info.legalConfigured && <li><b>LEGAL_NAME</b> y <b>LEGAL_EMAIL</b>: nombre legal de tu empresa y correo para los <Link href="/terminos">Términos</Link>.</li>}
          </ul>
        </div>
      )}
      <div className="kpis">
        <Kpi label="Pedidos hoy" value={today.length} />
        <Kpi label="Activos" value={list.filter((o) => ACTIVE_STATUSES.includes(o.status)).length} />
        <Kpi label="Entregados hoy" value={delivered.length} />
        <Kpi label="Ingresos hoy" value={money(revenue)} />
        <Kpi label="Pago a repartidores" value={money(pay)} />
        <Kpi label="Te queda (antes de gastos)" value={money(revenue - pay)} />
      </div>
      <div className="card">
        <div className="row between"><h2>Pedidos</h2>{info?.demo && list.length > 0 && <button className="btn sm ghost danger" onClick={reset}>Borrar pedidos de prueba</button>}</div>
        {isLoading ? <Skeletons />
          : error ? <div className="err">{errorMessage(error)}</div>
          : list.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>#</th><th>Fecha</th><th>Ruta</th><th>Millas</th><th>Precio</th><th>Repartidor</th><th>Pago repartidor</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>{visible.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.num}</b></td><td>{fmtDate(o.createdAt)}</td>
                  <td className="small">{o.pickup.label.split(',')[0]} → {o.dropoff.label.split(',')[0]}</td>
                  <td>{o.miles}</td><td>{money(o.price)}<div className="tiny muted">{o.payment.method === 'tarjeta' ? 'Tarjeta' : 'Efectivo'}{o.payment.status === 'reembolsado' ? ' · reembolsado' : o.payment.status === 'reembolso_parcial' ? ` · reembolsó ${money(o.payment.refunded)}` : ''}{o.payment.disputed ? ' · EN DISPUTA' : ''}</div></td>
                  <td>{o.driver ? `${o.driver.name} · ${money(o.driverPay)}` : '—'}</td>
                  <td className="small">{o.payout ? <>
                    {PAYOUT_TEXT[o.payout.status]}
                    {o.payout.status === 'fallido' && <div><button className="btn sm ghost" disabled={retrying} onClick={() => retryPay(o.id)}>Reintentar pago</button></div>}
                  </> : '—'}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{(o.status === 'pendiente' || o.status === 'asignado' || o.status === 'por_pagar') && <button className="btn sm ghost danger" onClick={() => cancel(o.id)}>Cancelar</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          ) : <div className="empty">Aún no hay pedidos. Entra como cliente y haz uno de prueba.</div>}
      </div>
    </>
  );
}
