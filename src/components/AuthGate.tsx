'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import LoginForm from './LoginForm';
import { Skeletons } from './orders';
import { errorMessage, useMeQuery, useUpdateMeMutation } from '@/store/api';
import type { User } from '@/lib/types';

/** Muestra el contenido solo con sesión iniciada; si no, pide entrar con el teléfono. */
export default function AuthGate({ children, intro }: { children: (user: User) => ReactNode; intro?: string }) {
  const { data: user, isLoading } = useMeQuery();
  if (isLoading) return <Skeletons />;
  if (!user) return <LoginForm intro={intro} />;
  if (!user.name) return <NameForm />;
  return <>{children(user)}</>;
}

function NameForm() {
  const [name, setName] = useState('');
  const [update, { isLoading, error }] = useUpdateMeMutation();
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await update({ name }).unwrap(); } catch { /* error abajo */ } };
  return (
    <form className="card" onSubmit={submit}>
      <h2>¿Cómo te llamas?</h2>
      <p className="small muted">Así te verá el repartidor o el cliente.</p>
      <div className="stack"><label className="f" htmlFor="my-name">Nombre</label><input className="in" id="my-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      {error && <div className="err">{errorMessage(error)}</div>}
      <button className="btn primary block" type="submit" disabled={isLoading || !name.trim()}>{isLoading ? <span className="spin" /> : 'Continuar'}</button>
    </form>
  );
}
