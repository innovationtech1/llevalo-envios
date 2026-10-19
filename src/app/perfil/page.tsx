'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { ROLE_NAME, roleHome } from '@/components/AppShell';
import AuthGate from '@/components/AuthGate';
import Icon from '@/components/Icon';
import { errorMessage, useLogoutMutation, useUpdateMeMutation } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole } from '@/store/sessionSlice';
import { showToast } from '@/store/uiSlice';
import { prettyPhone } from '@/lib/constants';
import type { Role, User } from '@/lib/types';

export default function ProfilePage() {
  return (
    <AppShell>
      <h1>Perfil</h1>
      <AuthGate>{(user) => <Profile user={user} />}</AuthGate>
      <div className="notice info"><Icon name="info" size={18} /><span>Instálala en tu celular: en iPhone toca Compartir → &quot;Agregar a inicio&quot;; en Android, menú → &quot;Instalar app&quot;.</span></div>
    </AppShell>
  );
}

const DRIVER_TEXT = { ninguno: 'No eres repartidor', pendiente: 'Solicitud en revisión', aprobado: 'Repartidor aprobado', rechazado: 'Solicitud no aprobada' };

function Profile({ user }: { user: User }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.session.role);
  const [name, setName] = useState(user.name);
  const [update, { isLoading: saving }] = useUpdateMeMutation();
  const [logout] = useLogoutMutation();
  useEffect(() => setName(user.name), [user.name]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await update({ name }).unwrap(); dispatch(showToast('Perfil guardado')); } catch (err) { dispatch(showToast(errorMessage(err))); }
  };
  const change = (r: Role) => { dispatch(setRole(r)); router.push(roleHome(r)); };
  const exit = async () => { await logout(); dispatch(showToast('Saliste de tu cuenta')); router.push('/'); };

  const modes: Role[] = ['cliente', 'repartidor', ...(user.isAdmin ? ['admin' as Role] : [])];

  return (
    <>
      <form className="card" onSubmit={submit}>
        <div className="stack"><label className="f" htmlFor="pn">Nombre</label><input className="in" id="pn" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="stack"><span className="f">Teléfono</span><div className="in" style={{ display: 'flex', alignItems: 'center', background: 'var(--ground)' }}>{prettyPhone(user.phone)}</div></div>
        <div className="small muted">{DRIVER_TEXT[user.driverStatus]}{user.isAdmin ? ' · Administrador' : ''}</div>
        <button className="btn ink block" type="submit" disabled={saving || !name.trim() || name === user.name}>Guardar</button>
      </form>
      <div className="card">
        <h3>Cambiar de modo</h3>
        <div className={modes.length === 3 ? 'grid3' : 'grid2'}>
          {modes.map((r) => <button key={r} className="choice" aria-pressed={role === r} onClick={() => change(r)}><b>{ROLE_NAME[r]}</b></button>)}
        </div>
      </div>
      <button className="btn ghost block" onClick={exit}>Cerrar sesión</button>
    </>
  );
}
