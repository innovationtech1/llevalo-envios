'use client';

import Link from 'next/link';
import AppShell from '@/components/AppShell';
import AuthGate from '@/components/AuthGate';
import { Empty, OrderCard, Skeletons } from '@/components/orders';
import { errorMessage, useOrdersQuery } from '@/store/api';

export default function ClientOrdersPage() {
  return (
    <AppShell role="cliente">
      <h1>Mis envíos</h1>
      <AuthGate intro="Entra con tu número para ver tus envíos.">{() => <List />}</AuthGate>
    </AppShell>
  );
}

function List() {
  const { data, isLoading, error } = useOrdersQuery('mine', { pollingInterval: 10000 });
  if (isLoading) return <Skeletons />;
  if (error) return <div className="err">{errorMessage(error)}</div>;
  if (!data?.length) return <Empty icon="box"><p>Todavía no tienes envíos.</p><Link className="btn primary" href="/cliente/nuevo">Hacer mi primer envío</Link></Empty>;
  return <div className="list">{data.map((o) => <OrderCard key={o.id} o={o} href={`/cliente/envios/${o.id}`} />)}</div>;
}
