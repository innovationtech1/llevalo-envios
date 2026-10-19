'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { ROLE_NAME, roleHome } from '@/components/AppShell';
import Icon from '@/components/Icon';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setAdminPin, setProfile, setRole } from '@/store/sessionSlice';
import { showToast } from '@/store/uiSlice';
import type { Role } from '@/lib/types';

export default function ProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const s = useAppSelector((st) => st.session);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => { if (s.hydrated) { setName(s.name); setPhone(s.phone); } }, [s.hydrated, s.name, s.phone]);

  const submit = (e: FormEvent) => { e.preventDefault(); dispatch(setProfile({ name, phone })); dispatch(showToast('Perfil guardado')); };
  const change = (r: Role) => { dispatch(setRole(r)); router.push(roleHome(r)); };

  return (
    <AppShell>
      <h1>Perfil</h1>
      <form className="card" onSubmit={submit}>
        <div className="stack"><label className="f" htmlFor="pn">Nombre</label><input className="in" id="pn" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="stack"><label className="f" htmlFor="pp">Teléfono</label><input className="in" id="pp" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <button className="btn ink block" type="submit">Guardar</button>
      </form>
      <div className="card">
        <h3>Cambiar de modo</h3>
        <div className="grid3">
          {(['cliente', 'repartidor', 'admin'] as Role[]).map((r) => (
            <button key={r} className="choice" aria-pressed={s.role === r} onClick={() => change(r)}><b>{ROLE_NAME[r]}</b></button>
          ))}
        </div>
        {s.adminPin && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { dispatch(setAdminPin('')); dispatch(showToast('Saliste del panel')); }}>Cerrar sesión de administrador</button>}
      </div>
      <div className="notice info"><Icon name="info" size={18} /><span>Instálala en tu celular: en iPhone toca Compartir → &quot;Agregar a inicio&quot;; en Android, menú → &quot;Instalar app&quot;.</span></div>
    </AppShell>
  );
}
