'use client';

import type { ReactNode } from 'react';
import AuthGate from './AuthGate';
import Icon from './Icon';
import { errorMessage, useUpdateMeMutation } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import type { User } from '@/lib/types';

/** Solo repartidores aprobados por el administrador. Los demás pueden solicitarlo aquí. */
export default function DriverGate({ children }: { children: (user: User) => ReactNode }) {
  return (
    <AuthGate intro="Entra con tu número para trabajar como repartidor.">
      {(user) => (user.driverStatus === 'aprobado' || user.isAdmin ? children(user) : <Apply user={user} />)}
    </AuthGate>
  );
}

function Apply({ user }: { user: User }) {
  const dispatch = useAppDispatch();
  const [update, { isLoading }] = useUpdateMeMutation();
  const apply = async () => {
    try { await update({ applyDriver: true }).unwrap(); dispatch(showToast('Solicitud enviada')); }
    catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  if (user.driverStatus === 'pendiente') {
    return (
      <div className="card">
        <div className="row"><Icon name="info" /><h2>Solicitud en revisión</h2></div>
        <p className="muted">Recibimos tu solicitud para ser repartidor. Te avisaremos cuando el administrador la apruebe. Revisa esta pantalla más tarde.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>Trabaja como repartidor</h2>
      {user.driverStatus === 'rechazado'
        ? <p className="muted">Tu solicitud anterior no fue aprobada. Si crees que fue un error, puedes volver a enviarla.</p>
        : <p className="muted">Gana dinero entregando paquetes en San Antonio con tu propio vehículo. El administrador revisará tu solicitud antes de que puedas aceptar envíos.</p>}
      <button className="btn primary block" onClick={apply} disabled={isLoading}>{isLoading ? <span className="spin" /> : 'Quiero ser repartidor'}</button>
    </div>
  );
}
