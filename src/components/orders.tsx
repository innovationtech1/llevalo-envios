'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from './Icon';
import { STATUS, prettyPhone, sizeLabel } from '@/lib/constants';
import { fmtDate, fmtTime, money } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={'badge ' + STATUS[status].badge}>{STATUS[status].label}</span>;
}

export function OrderCard({ o, href, right }: { o: Order; href: string; right?: ReactNode }) {
  return (
    <Link className="card order" href={href}>
      <div className="row between"><span className="eyebrow">#{o.num} · {fmtDate(o.createdAt)}</span><StatusBadge status={o.status} /></div>
      <div className="small">{o.pickup.label}</div>
      <div className="small muted">→ {o.dropoff.label}</div>
      <div className="row between small"><span className="muted">{o.miles} mi · {sizeLabel(o.size)}</span>{right ?? <b>{money(o.price)}</b>}</div>
    </Link>
  );
}

const STEPS: [OrderStatus, string][] = [['pendiente', 'Pedido recibido'], ['asignado', 'Repartidor asignado'], ['recogido', 'Recogido'], ['entregado', 'Entregado']];

export function Timeline({ o }: { o: Order }) {
  const cur = STEPS.findIndex(([s]) => s === o.status);
  const at = (st: OrderStatus) => { const h = o.history.find((x) => x.status === st); return h ? fmtTime(h.at) : ''; };
  return (
    <ol className="timeline" aria-label="Estado del envío">
      {STEPS.map(([st, label], i) => {
        const cls = o.status === 'cancelado' ? (i === 0 ? 'done' : '') : i < cur ? 'done' : i === cur ? (st === 'entregado' ? 'done' : 'now') : '';
        return (
          <li key={st} className={cls} aria-current={i === cur ? 'step' : undefined}>
            <div className="rail"><div className="pt" /><div className="ln" /></div>
            <div className="txt">
              <b style={{ fontSize: 14 }}>{label}</b>
              <span className="tiny muted">{at(st)}{st === 'asignado' && o.driver ? ' · ' + o.driver.name : ''}</span>
            </div>
          </li>
        );
      })}
      {o.status === 'cancelado' && (
        <li className="now"><div className="rail"><div className="pt" /></div><div className="txt"><b style={{ fontSize: 14 }}>Cancelado</b><span className="tiny muted">{at('cancelado')}</span></div></li>
      )}
    </ol>
  );
}

export function RouteCard({ o, withNav = false }: { o: Order; withNav?: boolean }) {
  const nav = (p: Order['pickup']) => withNav && (
    <a className="btn sm" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noopener noreferrer">
      <Icon name="nav" size={16} /> Ir
    </a>
  );
  const label = { fontSize: 12, fontWeight: 700, color: 'var(--muted)' } as const;
  return (
    <div className="card">
      <div className="route">
        <div className="rail" style={{ paddingTop: 6 }}><span className="dot" /><span className="line" /><span className="sq" /></div>
        <div className="stack" style={{ flex: 1, gap: 14 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 2 }}><span style={label}>Recoger</span><span>{o.pickup.label}</span>
              <span className="tiny muted">{o.senderName}{o.senderPhone ? ' · ' + prettyPhone(o.senderPhone) : ''}</span></div>
            {nav(o.pickup)}
          </div>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 2 }}><span style={label}>Entregar</span><span>{o.dropoff.label}</span>
              <span className="tiny muted">{o.recName || 'Sin nombre'}{o.recPhone ? ' · ' + prettyPhone(o.recPhone) : ''}</span></div>
            {nav(o.dropoff)}
          </div>
        </div>
      </div>
      <div className="row small muted" style={{ flexWrap: 'wrap', gap: '6px 14px' }}>
        <span>{o.miles} mi</span><span>{sizeLabel(o.size)}</span>
        <span>{o.when === 'prog' && o.scheduledAt ? 'Programado: ' + fmtDate(o.scheduledAt) : 'Lo antes posible'}</span>
      </div>
      {o.notes && <div className="small"><b>Notas:</b> {o.notes}</div>}
    </div>
  );
}

export function Empty({ icon, children }: { icon: 'box' | 'bike' | 'list'; children: ReactNode }) {
  return <div className="empty"><Icon name={icon} size={36} />{children}</div>;
}

export function Skeletons({ n = 2 }: { n?: number }) {
  return <div className="list" aria-busy="true" aria-label="Cargando">{Array.from({ length: n }, (_, i) => <div key={i} className="skeleton" />)}</div>;
}
