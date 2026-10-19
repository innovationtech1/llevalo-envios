'use client';

import AppShell from '@/components/AppShell';
import DriverGate from '@/components/DriverGate';
import { Empty, OrderCard, Skeletons } from '@/components/orders';
import { errorMessage, useOrdersQuery } from '@/store/api';
import { money } from '@/lib/format';

export default function DriverMinePage() {
  return <AppShell role="repartidor"><DriverGate>{() => <Mine />}</DriverGate></AppShell>;
}

function Mine() {
  const { data, isLoading, error } = useOrdersQuery('driver');
  const total = (data ?? []).filter((o) => o.status === 'entregado').reduce((a, o) => a + o.driverPay, 0);
  return (
    <>
      <h1>Mis entregas</h1>
      <div className="card dark" style={{ gap: 4 }}><span className="small muted">Total ganado</span><span className="big">{money(total)}</span></div>
      {isLoading ? <Skeletons />
        : error ? <div className="err">{errorMessage(error)}</div>
        : data?.length ? <div className="list">{data.map((o) => <OrderCard key={o.id} o={o} href={`/repartidor/envios/${o.id}`} right={<b>{money(o.driverPay)}</b>} />)}</div>
        : <Empty icon="list"><p>Aún no has aceptado envíos.</p></Empty>}
    </>
  );
}
