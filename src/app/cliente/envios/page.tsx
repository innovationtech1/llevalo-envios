'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import AppShell from '@/components/AppShell';
import { Empty, OrderCard, Skeletons } from '@/components/orders';
import { errorMessage, useOrdersQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setProfile } from '@/store/sessionSlice';

export default function ClientOrders() {
  const { phone, hydrated } = useAppSelector((s) => s.session);
  const { data, isLoading, error } = useOrdersQuery({ phone }, { skip: !phone, pollingInterval: 10000 });

  return (
    <AppShell role="cliente">
      <h1>Mis envíos</h1>
      {!hydrated ? <Skeletons /> : !phone ? <PhoneForm />
        : isLoading ? <Skeletons />
        : error ? <div className="err">{errorMessage(error)}</div>
        : data?.length ? <div className="list">{data.map((o) => <OrderCard key={o.id} o={o} href={`/cliente/envios/${o.id}`} />)}</div>
        : <Empty icon="box"><p>Todavía no tienes envíos.</p><Link className="btn primary" href="/cliente/nuevo">Hacer mi primer envío</Link></Empty>}
    </AppShell>
  );
}

function PhoneForm() {
  const dispatch = useAppDispatch();
  const [v, setV] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (v.replace(/\D/g, '').length >= 7) dispatch(setProfile({ phone: v })); };
  return (
    <form className="card" onSubmit={submit}>
      <p className="small muted">Tus envíos se buscan con el teléfono que usaste al pedir.</p>
      <div className="stack"><label className="f" htmlFor="ph">Tu teléfono</label><input className="in" id="ph" type="tel" autoComplete="tel" value={v} onChange={(e) => setV(e.target.value)} /></div>
      <button className="btn ink block" type="submit">Ver mis envíos</button>
    </form>
  );
}
