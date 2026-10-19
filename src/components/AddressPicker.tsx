'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
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

/**
 * Busca una dirección en el servidor y deja elegir entre los resultados.
 * Busca sola al salir del campo, y si solo hay un resultado lo elige automáticamente.
 */
export default function AddressPicker({ id, label, marker, value, onChange }: Props) {
  const [q, setQ] = useState('');
  const lastSearched = useRef('');
  const [trigger, { data, isFetching, error, isUninitialized }] = useLazyGeocodeQuery();
  const { data: zones } = useZonesQuery();

  const search = async () => {
    const text = q.trim();
    if (text.length < 4 || text === lastSearched.current) return;
    lastSearched.current = text;
    try {
      const results = await trigger(text, true).unwrap();
      if (results.length === 1) onChange(results[0]);
    } catch { /* el error se muestra abajo */ }
  };
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
          <button type="button" className="btn sm ghost" onClick={() => { onChange(null); lastSearched.current = ''; setTimeout(() => document.getElementById(id)?.focus(), 0); }}>Cambiar</button>
        </div>
      </div>
    );
  }

  const typed = q.trim().length >= 4;
  const showResults = !isUninitialized && !isFetching && data;

  return (
    <div className="stack">
      {head}
      <div className="in-row">
        <input className="in" id={id} placeholder="Ej. 100 Military Plaza, San Antonio" autoComplete="street-address"
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onBlur={search} aria-describedby={id + '-help'} />
        <button type="button" className="btn primary" style={{ minWidth: 48, padding: '0 14px', borderRadius: 12 }} onClick={search} aria-label={`Buscar ${label.toLowerCase()}`} disabled={!typed}>
          {isFetching ? <span className="spin" /> : <><Icon name="search" size={18} /> Buscar</>}
        </button>
      </div>
      {error ? <div className="err">{errorMessage(error)}</div>
        : showResults ? (data.length
          ? <>
              <div className="small" style={{ fontWeight: 700, color: 'var(--accent)' }}>Toca la dirección correcta para confirmarla:</div>
              <div className="results">{data.map((r, i) => <button type="button" key={i} onClick={() => onChange(r)}>{r.label}</button>)}</div>
            </>
          : <div className="small muted">No encontramos esa dirección. Prueba con número, calle y ciudad.</div>)
        : <div id={id + '-help'} className="tiny muted">{typed ? 'Toca "Buscar" para confirmar la dirección.' : 'Escribe número, calle y ciudad.'}</div>}
    </div>
  );
}
