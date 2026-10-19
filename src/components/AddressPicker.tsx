'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Icon from './Icon';
import { errorMessage, useInfoQuery, useLazyAutocompleteQuery, useLazyGeocodeQuery, useLazyPlaceDetailsQuery, useZonesQuery } from '@/store/api';
import { zoneForZip } from '@/lib/pricing';
import type { Place, Suggestion } from '@/lib/types';

interface Props {
  id: string;
  label: string;
  marker: 'dot' | 'sq';
  value: Place | null;
  onChange: (p: Place | null) => void;
}

/** Campo de dirección: con Google Maps sugiere mientras escribes; sin él, busca al tocar "Buscar". */
export default function AddressPicker(props: Props) {
  const { data: info } = useInfoQuery();
  const { data: zones } = useZonesQuery();
  const { id, label, marker, value, onChange } = props;
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
      {info?.maps === 'google' ? <Autocomplete {...props} /> : <SearchBox {...props} />}
    </div>
  );
}

const newSession = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

/** Sugerencias de Google mientras escribes (combobox accesible con teclado). */
function Autocomplete({ id, label, onChange }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const session = useRef(newSession());
  const [fetchSuggest, { data: suggestions, isFetching, error }] = useLazyAutocompleteQuery();
  const [fetchDetails, { isFetching: confirming, error: detailsError }] = useLazyPlaceDetailsQuery();

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) return;
    const t = setTimeout(() => { fetchSuggest({ q: text, session: session.current }, true); setOpen(true); setActive(-1); }, 250);
    return () => clearTimeout(t);
  }, [q, fetchSuggest]);

  const pick = async (s: Suggestion) => {
    setOpen(false);
    setQ(`${s.main}${s.secondary ? ', ' + s.secondary : ''}`);
    try {
      const place = await fetchDetails({ id: s.id, session: session.current }, true).unwrap();
      session.current = newSession(); // una sesión de Google por dirección elegida
      onChange(place);
    } catch { /* el error se muestra abajo */ }
  };

  const list = q.trim().length >= 3 ? suggestions ?? [] : [];
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, list.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(list[active >= 0 ? active : 0]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        <input className="in" id={id} role="combobox" aria-expanded={open && list.length > 0} aria-controls={id + '-list'} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          placeholder="Empieza a escribir la dirección…" autoComplete="off" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {(isFetching || confirming) && <span className="spin" style={{ position: 'absolute', right: 14, top: 14, color: 'var(--muted)' }} />}
      </div>
      {open && list.length > 0 && (
        <div className="results" id={id + '-list'} role="listbox" aria-label={label}>
          {list.map((s, i) => (
            <button type="button" key={s.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              style={i === active ? { background: 'var(--ground)' } : undefined}
              onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}>
              <span className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <Icon name="pin" size={16} />
                <span className="stack" style={{ gap: 0 }}><b style={{ fontSize: 14 }}>{s.main}</b><span className="tiny muted">{s.secondary}</span></span>
              </span>
            </button>
          ))}
        </div>
      )}
      {error || detailsError ? <div className="err">{errorMessage(error || detailsError)}</div>
        : open && q.trim().length >= 3 && !isFetching && suggestions && !suggestions.length ? <div className="small muted">Sin sugerencias. Revisa cómo está escrita.</div>
        : <div className="tiny muted">Escribe y elige tu dirección de la lista.</div>}
    </>
  );
}

/** Búsqueda manual (OpenStreetMap): escribe y toca "Buscar". */
function SearchBox({ id, label, onChange }: Props) {
  const [q, setQ] = useState('');
  const lastSearched = useRef('');
  const [trigger, { data, isFetching, error, isUninitialized }] = useLazyGeocodeQuery();

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
  const typed = q.trim().length >= 4;

  return (
    <>
      <div className="in-row">
        <input className="in" id={id} placeholder="Ej. 100 Military Plaza, San Antonio" autoComplete="street-address"
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onBlur={search} />
        <button type="button" className="btn primary" style={{ minWidth: 48, padding: '0 14px', borderRadius: 12 }} onClick={search} aria-label={`Buscar ${label.toLowerCase()}`} disabled={!typed}>
          {isFetching ? <span className="spin" /> : <><Icon name="search" size={18} /> Buscar</>}
        </button>
      </div>
      {error ? <div className="err">{errorMessage(error)}</div>
        : !isUninitialized && !isFetching && data ? (data.length
          ? <>
              <div className="small" style={{ fontWeight: 700, color: 'var(--accent)' }}>Toca la dirección correcta para confirmarla:</div>
              <div className="results">{data.map((r, i) => <button type="button" key={i} onClick={() => onChange(r)}>{r.label}</button>)}</div>
            </>
          : <div className="small muted">No encontramos esa dirección. Prueba con número, calle y ciudad.</div>)
        : <div className="tiny muted">{typed ? 'Toca "Buscar" para confirmar la dirección.' : 'Escribe número, calle y ciudad.'}</div>}
    </>
  );
}
