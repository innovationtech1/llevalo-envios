'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import Icon, { type IconName } from './Icon';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole } from '@/store/sessionSlice';
import type { Role } from '@/lib/types';

const TABS: Record<Role, [string, string, IconName][]> = {
  cliente: [['/cliente', 'Inicio', 'home'], ['/cliente/nuevo', 'Enviar', 'plus'], ['/cliente/envios', 'Mis envíos', 'list'], ['/perfil', 'Perfil', 'user']],
  repartidor: [['/repartidor', 'Trabajos', 'bike'], ['/repartidor/mios', 'Mis entregas', 'list'], ['/perfil', 'Perfil', 'user']],
  admin: [['/admin', 'Resumen', 'chart'], ['/admin/tarifas', 'Tarifas', 'tag'], ['/admin/zonas', 'Zonas', 'map'], ['/perfil', 'Perfil', 'user']]
};

export const ROLE_NAME: Record<Role, string> = { cliente: 'Cliente', repartidor: 'Repartidor', admin: 'Administrador' };
export const roleHome = (r: Role) => (r === 'cliente' ? '/cliente' : r === 'repartidor' ? '/repartidor' : '/admin');

/** Marco común: barra superior, contenido y pestañas inferiores del modo actual. */
export default function AppShell({ role, children, wide = false }: { role?: Role; children: ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.session);
  const current = role ?? session.role ?? 'cliente';

  // Entrar a una sección cambia el modo (útil al abrir un enlace directo).
  useEffect(() => {
    if (role && session.hydrated && session.role !== role) dispatch(setRole(role));
  }, [role, session.hydrated, session.role, dispatch]);

  const tabs = TABS[current];
  const isActive = (href: string) => href === pathname || (href !== '/cliente' && href !== '/repartidor' && href !== '/admin' && pathname.startsWith(href + '/'))
    || (href === '/cliente/envios' && pathname.startsWith('/cliente/envios'));

  return (
    <>
      <div className={'shell' + (wide ? ' wide' : '')}>
        <header className="topbar">
          <Link className="brand" href="/">Llévalo<span>.</span></Link>
          <Link className="role-chip" href="/perfil"><Icon name="user" size={14} /> {ROLE_NAME[current]}</Link>
        </header>
        <main>{children}</main>
      </div>
      <nav className="tabbar" aria-label="Navegación">
        <div className="in">
          {tabs.map(([href, label, icon]) => (
            <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}>
              <Icon name={icon} />{label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

export function BackHeader({ href, title }: { href: string; title: string }) {
  return (
    <div className="row">
      <Link className="icon-btn" href={href} aria-label="Volver"><Icon name="back" size={20} /></Link>
      <h1 style={{ fontSize: 24 }}>{title}</h1>
    </div>
  );
}
