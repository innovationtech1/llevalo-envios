'use client';

import type { ReactNode } from 'react';
import Icon from './Icon';
import LoginForm from './LoginForm';
import { Skeletons } from './orders';
import { useInfoQuery, useMeQuery } from '@/store/api';
import { prettyPhone } from '@/lib/constants';

/** Panel solo para los teléfonos de ADMIN_PHONES (abierto en modo demo si aún no se configura). */
export default function AdminGate({ children }: { children: ReactNode }) {
  const { data: info, isLoading } = useInfoQuery();
  const { data: user, isLoading: loadingMe } = useMeQuery();

  if (isLoading || loadingMe || !info) return <Skeletons />;
  if (!info.adminConfigured && info.demo) return <>{children}</>;
  if (!user) return <LoginForm title="Panel de administrador" intro="Entra con el teléfono de administrador." />;
  if (!info.adminConfigured) {
    return (
      <div className="card">
        <div className="row"><Icon name="lock" /><h2>Falta un paso</h2></div>
        <p className="muted">Para proteger el panel, agrega en Vercel la variable <b>ADMIN_PHONES</b> con tu número y vuelve a publicar.</p>
        <p className="small">Tu número: <b>{prettyPhone(user.phone)}</b></p>
      </div>
    );
  }
  if (!user.isAdmin) {
    return (
      <div className="card">
        <div className="row"><Icon name="lock" /><h2>Sin acceso</h2></div>
        <p className="muted">Este panel es solo para el administrador.</p>
      </div>
    );
  }
  return <>{children}</>;
}
