'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setOnline, setProfile } from '@/store/sessionSlice';
import { Skeletons } from './orders';

/** Pide nombre y teléfono al repartidor la primera vez. */
export default function DriverGate({ children }: { children: ReactNode }) {
  const { hydrated, name } = useAppSelector((s) => s.session);
  const dispatch = useAppDispatch();
  const [n, setN] = useState('');
  const [p, setP] = useState('');
  if (!hydrated) return <Skeletons />;
  if (name) return <>{children}</>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!n.trim()) return;
    dispatch(setProfile({ name: n, phone: p }));
    dispatch(setOnline(true));
  };
  return (
    <>
      <h1>Antes de empezar</h1>
      <form className="card" onSubmit={submit}>
        <div className="stack"><label className="f" htmlFor="dn">Tu nombre</label><input className="in" id="dn" required autoComplete="name" value={n} onChange={(e) => setN(e.target.value)} /></div>
        <div className="stack"><label className="f" htmlFor="dp">Tu teléfono</label><input className="in" id="dp" type="tel" autoComplete="tel" value={p} onChange={(e) => setP(e.target.value)} /></div>
        <button className="btn primary block" type="submit">Guardar y ver trabajos</button>
      </form>
    </>
  );
}
