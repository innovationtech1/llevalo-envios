'use client';

import { useState, type KeyboardEvent } from 'react';
import Icon from './Icon';
import { errorMessage, useLazyGeocodeQuery, useZonesQuery } from '@/store/api';
import { zoneForZip } from '@/lib/pricing';
import type { Place } from '@/lib/types';

interface Props {
  id: string;
  label: string;
  marker: 'dot' | 'sq';
  value: Place | null;
  onChange: (p: Place | null) => void;
}

/** Busca una dirección en el servidor y deja elegir entre los resultados. */
export default function AddressPicker({ id, label, marker, value, onChange }: Props) {
  const [q, setQ] = useState('');
  const [trigger, { data, isFetching, error, isUninitialized }] = useLazyGeocodeQuery();
  const { data: zones } = useZonesQuery();

  const search = () => { if (q.trim().length >= 4) trigger(q.trim(), true); };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); search(); } };

  const head = <label className="f" htmlFor={id}><span className={marker} style={{ display: 'inline-block', verticalAlign: -1 }} /> {label}</label>;

  if (value) {
    const zone = zones ? zoneForZip(zones, value.zip) : null;
    return (
      <div className="stack">
        {head}
        <div className="picked">
          <div className="grow">
            <div>{value.label}</div>
            <div className="tiny" style={{ marginTop: 4 }}>
              {zone ? <span className="badge b-ok">Zona {zone.name}</span> : <span className="badge b-off">Fuera de zona{value.zip ? ' · ' + value.zip : ''}</span>}
            </div>
          </div>
          <button type="button" className="btn sm ghost" onClick={() => { onChange(null); setTimeout(() => document.getElementById(id)?.focus(), 0); }}>Cambiar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {head}
      <div className="in-row">
        <input className="in" id={id} placeholder="Calle, número y ciudad" autoComplete="street-address" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
        <button type="button" className="icon-btn" style={{ width: 48, height: 48, borderRadius: 12 }} onClick={search} aria-label={`Buscar ${label.toLowerCase()}`} disabled={q.trim().length < 4}>
          {isFetching ? <span className="spin" /> : <Icon name="search" size={20} />}
        </button>
      </div>
      {error ? <div className="err">{errorMessage(error)}</div>
        : !isUninitialized && !isFetching && data && (data.length
          ? <div className="results">{data.map((r, i) => <button type="button" key={i} onClick={() => onChange(r)}>{r.label}</button>)}</div>
          : <div className="small muted">No encontramos esa dirección. Prueba con número, calle y ciudad.</div>)}
    </div>
  );
}
