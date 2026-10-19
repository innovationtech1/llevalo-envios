'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import AppShell from '@/components/AppShell';
import Icon from '@/components/Icon';
import { StatusBadge } from '@/components/orders';
import { useMeQuery, useOrdersQuery, useZonesQuery } from '@/store/api';
import { zoneForZip } from '@/lib/pricing';
import { ACTIVE_STATUSES } from '@/lib/constants';

export default function ClientHome() {
  const [zip, setZip] = useState('');
  const [checked, setChecked] = useState('');
  const { data: zones } = useZonesQuery();
  const { data: me } = useMeQuery();
  const { data: orders } = useOrdersQuery('mine', { skip: !me, pollingInterval: 15000 });
  const active = orders?.find((o) => ACTIVE_STATUSES.includes(o.status));
  const unpaid = orders?.find((o) => o.status === 'por_pagar');

  const valid = /^\d{5}$/.test(checked);
  const zone = valid && zones ? zoneForZip(zones, checked) : null;
  const submit = (e: FormEvent) => { e.preventDefault(); setChecked(zip.trim()); };

  return (
    <AppShell role="cliente">
      <h1>{me?.name ? `Hola, ${me.name.split(' ')[0]}. ¿Qué enviamos hoy?` : '¿Qué quieres enviar hoy?'}</h1>
      <form className="card dark" onSubmit={submit}>
        <label className="f" htmlFor="zip">Tu código postal define qué servicios tienes</label>
        <div className="in-row">
          <input className="in" id="zip" inputMode="numeric" maxLength={5} autoComplete="postal-code" placeholder="Ej. 78201" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} />
          <button className="btn primary" type="submit">Ver servicios</button>
        </div>
        {checked && (
          <div className="row small"><Icon name="pin" size={14} />
            <span>{!valid ? 'Escribe un código de 5 dígitos' : zone ? <>Estás en la zona <b>{zone.name}</b></> : `Aún no llegamos al ${checked}`}</span>
          </div>
        )}
      </form>

      {(active || unpaid) && (() => {
        const o = (active || unpaid)!;
        return (
          <Link className="card order" href={`/cliente/envios/${o.id}`}>
            <div className="row between"><span className="eyebrow">{o.status === 'por_pagar' ? 'Falta pagar' : 'Envío activo'} #{o.num}</span><StatusBadge status={o.status} /></div>
            <div className="small">{o.pickup.label} → {o.dropoff.label}</div>
          </Link>
        );
      })()}

      <div className="eyebrow">Servicios</div>
      <Link className="card svc" href="/cliente/nuevo">
        <span className="ico" style={{ background: 'var(--accent-tint)' }}><Icon name="bike" size={24} color="#C44A06" /></span>
        <span className="stack" style={{ gap: 3, flex: 1 }}><b style={{ fontSize: 17 }}>Mensajería local</b><span className="small muted">Recogemos y entregamos en tu ciudad. Precio por milla.</span></span>
        {!checked ? <span className="badge b-info">Revisa tu zona</span> : zone ? <span className="badge b-ok">Disponible</span> : <span className="badge b-off">No disponible</span>}
      </Link>
      <Soon icon="box" title="Paquetería nacional" desc="UPS, FedEx y USPS en un solo lugar" />
      <Soon icon="food" title="Comida a domicilio" desc="Restaurantes afiliados de tu zona" />
    </AppShell>
  );
}

function Soon({ icon, title, desc }: { icon: 'box' | 'food'; title: string; desc: string }) {
  return (
    <div className="card svc" style={{ background: 'var(--off-tint)' }}>
      <span className="ico" style={{ background: 'var(--line)' }}><Icon name={icon} size={24} color="#5B6670" /></span>
      <span className="stack" style={{ gap: 3, flex: 1 }}><b style={{ fontSize: 17 }}>{title}</b><span className="small muted">{desc}</span></span>
      <span className="badge b-off">Próximamente</span>
    </div>
  );
}
