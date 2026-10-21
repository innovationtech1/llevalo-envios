'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon, { type IconName } from '@/components/Icon';
import { roleHome } from '@/components/AppShell';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole } from '@/store/sessionSlice';
import type { Role } from '@/lib/types';

const ROLES: { role: Role; title: string; desc: string; icon: IconName; bg: string; fg: string }[] = [
  { role: 'cliente', title: 'Soy cliente', desc: 'Cotizo por millas y pido un repartidor', icon: 'box', bg: 'var(--accent-tint)', fg: '#C44A06' },
  { role: 'repartidor', title: 'Soy repartidor', desc: 'Veo envíos cercanos y los entrego', icon: 'bike', bg: 'var(--info-tint)', fg: '#14212B' },
  { role: 'admin', title: 'Administrador', desc: 'Tarifas, zonas y todos los pedidos', icon: 'chart', bg: 'var(--warn-tint)', fg: '#7A5300' }
];

export default function Home() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { hydrated, role } = useAppSelector((s) => s.session);

  useEffect(() => { if (hydrated && role) router.replace(roleHome(role)); }, [hydrated, role, router]);

  const choose = (r: Role) => { dispatch(setRole(r)); router.push(roleHome(r)); };

  if (!hydrated || role) return <div className="shell"><main><div className="skeleton" style={{ marginTop: 80 }} /></main></div>;

  return (
    <div className="shell">
      <main style={{ paddingTop: 'calc(40px + env(safe-area-inset-top))' }}>
        <div className="brand" style={{ fontSize: 34 }}>Llévalo<span>.</span></div>
        <h1>Mensajería local en San Antonio</h1>
        <p className="muted">Elige cómo quieres entrar. Puedes cambiar de modo cuando quieras desde Perfil.</p>
        <div className="roles">
          {ROLES.map((r) => (
            <button key={r.role} className="role" onClick={() => choose(r.role)}>
              <span className="svc"><span className="ico" style={{ background: r.bg }}><Icon name={r.icon} size={24} color={r.fg} /></span></span>
              <span className="stack" style={{ gap: 2 }}><b style={{ fontSize: 17 }}>{r.title}</b><span className="small muted">{r.desc}</span></span>
            </button>
          ))}
        </div>
        <nav className="row small" style={{ flexWrap: 'wrap', gap: 16, justifyContent: 'center' }} aria-label="Documentos legales">
          <a href="/terminos">Términos</a><a href="/privacidad">Privacidad</a><a href="/acuerdo-repartidor">Acuerdo de repartidor</a>
        </nav>
      </main>
    </div>
  );
}
