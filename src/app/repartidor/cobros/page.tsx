'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import DriverGate from '@/components/DriverGate';
import Icon from '@/components/Icon';
import { Skeletons } from '@/components/orders';
import { errorMessage, useDriverPayoutsActionMutation, useDriverPayoutsQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { money } from '@/lib/format';
import type { User } from '@/lib/types';

export default function PayoutsPage() {
  return (
    <AppShell role="repartidor">
      <h1>Cobros</h1>
      <DriverGate>{(user) => <Payouts user={user} />}</DriverGate>
    </AppShell>
  );
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="row">
        <span className="icon-btn" aria-hidden="true" style={done ? { background: 'var(--ok)', borderColor: 'var(--ok)', color: '#fff' } : undefined}>{done ? '✓' : n}</span>
        <h3 style={{ flex: 1 }}>{title}</h3>
        {done && <span className="badge b-ok">Listo</span>}
      </div>
      {children}
    </div>
  );
}

function Payouts({ user }: { user: User }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const search = useSearchParams();
  const { data: info, isLoading, error, refetch } = useDriverPayoutsQuery();
  const [act, { isLoading: busy }] = useDriverPayoutsActionMutation();
  const handled = useRef(false);

  // Al volver de Stripe, actualizamos el estado de la cuenta.
  useEffect(() => {
    if (handled.current || !(search.get('listo') || search.get('refrescar'))) return;
    handled.current = true;
    refetch();
    router.replace('/repartidor/cobros');
  }, [search, refetch, router]);

  const go = async (action: 'onboard' | 'dashboard') => {
    try {
      const r = await act(action).unwrap();
      if (r.url) window.location.assign(r.url);
    } catch (e) { dispatch(showToast(errorMessage(e))); }
  };
  const accept = async () => {
    try { await act('acceptTerms').unwrap(); dispatch(showToast('Acuerdo aceptado')); } catch (e) { dispatch(showToast(errorMessage(e))); }
  };

  if (isLoading) return <Skeletons n={2} />;
  if (error || !info) return <div className="err">{errorMessage(error)}</div>;

  const termsDone = Boolean(user.driverTermsAt) || info.termsAccepted;
  const ready = termsDone && (!info.enabled || info.payoutsEnabled);

  return (
    <>
      {ready
        ? <div className="notice info"><Icon name="info" size={18} /><span><b>Todo listo.</b> Ya puedes aceptar envíos{info.enabled ? ' y recibir tus pagos' : ''}.</span></div>
        : <p className="muted">Completa estos pasos para poder aceptar envíos y recibir tus pagos.</p>}

      <Step n={1} done={termsDone} title="Acuerdo de repartidor independiente">
        <p className="small muted">Trabajas como contratista independiente: tú decides cuándo y qué envíos tomar, usas tu propio vehículo y declaras tus impuestos.</p>
        <Link href="/acuerdo-repartidor" target="_blank" className="small">Leer el acuerdo completo</Link>
        {!termsDone && <button className="btn primary block" onClick={accept} disabled={busy}>He leído y acepto el acuerdo</button>}
      </Step>

      {info.enabled ? (
        <Step n={2} done={info.payoutsEnabled} title="Cuenta de cobros (Stripe)">
          <p className="small muted">Stripe, nuestro procesador de pagos, verifica tu identidad y guarda tus datos fiscales y tu cuenta para depositarte. Nosotros nunca vemos tu número de seguro social ni tu cuenta bancaria.</p>
          {!info.payoutsEnabled
            ? <button className="btn primary block" onClick={() => go('onboard')} disabled={busy || !termsDone}>
                {busy ? <span className="spin" /> : info.hasAccount ? 'Continuar configuración en Stripe' : 'Configurar mi cuenta de cobros'}
              </button>
            : <>
                {info.balance && (
                  <div className="grid2">
                    <div className="card dark" style={{ gap: 4 }}><span className="small muted">En camino a tu cuenta</span><span className="big" style={{ fontSize: 22 }}>{money(info.balance.pending + info.balance.available)}</span></div>
                    <div className="card dark" style={{ gap: 4 }}><span className="small muted">Pago instantáneo</span><span className="big" style={{ fontSize: 22 }}>{info.instantCapable ? 'Activo' : 'No disponible'}</span></div>
                  </div>
                )}
                {!info.instantCapable && (
                  <div className="notice"><Icon name="info" size={18} /><span>Para recibir tu dinero al instante después de cada entrega, agrega una <b>tarjeta de débito</b> (no prepagada) en tu cuenta de Stripe. Mientras tanto, te depositamos cada día hábil.</span></div>
                )}
                <button className="btn block" onClick={() => go('dashboard')} disabled={busy}>Ver mis pagos y datos en Stripe</button>
              </>}
        </Step>
      ) : (
        <div className="notice info"><Icon name="info" size={18} /><span><b>Modo prueba:</b> los pagos con tarjeta aún no están activados. Por ahora, el cliente te paga en efectivo al entregar.</span></div>
      )}
    </>
  );
}
