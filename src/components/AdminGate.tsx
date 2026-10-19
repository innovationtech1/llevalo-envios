'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import Icon from './Icon';
import { Skeletons } from './orders';
import { errorMessage, useCheckAdminMutation, useInfoQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setAdminPin } from '@/store/sessionSlice';

/** Si el servidor tiene ADMIN_PIN, pide el PIN antes de mostrar el panel. */
export default function AdminGate({ children }: { children: ReactNode }) {
  const { data: info, isLoading } = useInfoQuery();
  const { hydrated, adminPin } = useAppSelector((s) => s.session);
  const dispatch = useAppDispatch();
  const [pin, setPin] = useState('');
  const [check, { isLoading: checking, error }] = useCheckAdminMutation();

  if (isLoading || !hydrated) return <Skeletons />;
  if (!info?.adminPin || adminPin) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await check(pin).unwrap(); dispatch(setAdminPin(pin)); } catch { /* el error se muestra abajo */ }
  };

  return (
    <>
      <h1>Panel de administrador</h1>
      <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="row"><Icon name="lock" /><b>Escribe tu PIN</b></div>
        <input className="in" type="password" inputMode="numeric" autoComplete="current-password" aria-label="PIN de administrador" value={pin} onChange={(e) => setPin(e.target.value)} />
        {error && <div className="err">{errorMessage(error)}</div>}
        <button className="btn ink block" type="submit" disabled={!pin || checking}>{checking ? <span className="spin" /> : 'Entrar'}</button>
      </form>
    </>
  );
}
