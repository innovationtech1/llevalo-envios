'use client';

import AppShell from '@/components/AppShell';
import AdminGate from '@/components/AdminGate';
import { Skeletons } from '@/components/orders';
import { errorMessage, useDriversQuery, useSetDriverStatusMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { prettyPhone } from '@/lib/constants';
import { fmtDate } from '@/lib/format';
import type { DriverStatus } from '@/lib/types';

export default function DriversPage() {
  return <AppShell role="admin" wide><AdminGate><Drivers /></AdminGate></AppShell>;
}

const LABEL: Record<DriverStatus, { text: string; badge: string }> = {
  ninguno: { text: '—', badge: 'b-off' },
  pendiente: { text: 'Por revisar', badge: 'b-warn' },
  aprobado: { text: 'Aprobado', badge: 'b-ok' },
  rechazado: { text: 'Rechazado', badge: 'b-off' }
};

function Drivers() {
  const dispatch = useAppDispatch();
  const { data, isLoading, error } = useDriversQuery(undefined, { pollingInterval: 20000 });
  const [setStatus, { isLoading: saving }] = useSetDriverStatusMutation();

  const change = async (id: string, status: 'aprobado' | 'rechazado', name: string) => {
    try {
      await setStatus({ id, status }).unwrap();
      dispatch(showToast(status === 'aprobado' ? `${name} ya puede aceptar envíos` : `${name} fue rechazado`));
    } catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  const list = data ?? [];
  const pending = list.filter((u) => u.driverStatus === 'pendiente');
  const rest = list.filter((u) => u.driverStatus !== 'pendiente');

  return (
    <>
      <h1>Repartidores</h1>
      <p className="muted">Quien quiere trabajar contigo lo solicita desde el modo repartidor. Revisa sus datos y apruébalo para que pueda aceptar envíos.</p>
      {isLoading ? <Skeletons />
        : error ? <div className="err">{errorMessage(error)}</div>
        : !list.length ? <div className="card empty">Todavía nadie ha solicitado ser repartidor.</div>
        : <>
          {pending.length > 0 && <>
            <div className="eyebrow">Por revisar ({pending.length})</div>
            <div className="list">{pending.map((u) => (
              <div className="card" key={u.id}>
                <div className="row between"><b style={{ fontSize: 17 }}>{u.name || 'Sin nombre'}</b><span className={'badge ' + LABEL[u.driverStatus].badge}>{LABEL[u.driverStatus].text}</span></div>
                <div className="small muted"><a href={`tel:${u.phone}`}>{prettyPhone(u.phone)}</a> · cuenta desde {fmtDate(u.createdAt)}</div>
                <div className="grid2">
                  <button className="btn" disabled={saving} onClick={() => change(u.id, 'rechazado', u.name)}>Rechazar</button>
                  <button className="btn primary" disabled={saving} onClick={() => change(u.id, 'aprobado', u.name)}>Aprobar</button>
                </div>
              </div>
            ))}</div>
          </>}
          {rest.length > 0 && (
            <div className="card">
              <h3>Todos</h3>
              <div className="table-wrap"><table>
                <thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>{rest.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name || 'Sin nombre'}</b></td>
                    <td><a href={`tel:${u.phone}`}>{prettyPhone(u.phone)}</a></td>
                    <td><span className={'badge ' + LABEL[u.driverStatus].badge}>{LABEL[u.driverStatus].text}</span></td>
                    <td>{u.driverStatus === 'aprobado'
                      ? <button className="btn sm ghost danger" disabled={saving} onClick={() => change(u.id, 'rechazado', u.name)}>Quitar acceso</button>
                      : <button className="btn sm ghost" disabled={saving} onClick={() => change(u.id, 'aprobado', u.name)}>Aprobar</button>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          )}
        </>}
    </>
  );
}
