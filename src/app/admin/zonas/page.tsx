'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import AdminGate from '@/components/AdminGate';
import Icon from '@/components/Icon';
import { Skeletons } from '@/components/orders';
import { errorMessage, useSaveZonesMutation, useZonesQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { zoneForZip } from '@/lib/pricing';
import type { Zone } from '@/lib/types';

export default function ZonesPage() {
  return <AppShell role="admin" wide><AdminGate><Zones /></AdminGate></AppShell>;
}

type ZoneDraft = Omit<Zone, 'prefixes'> & { prefixes: string };

function Zones() {
  const dispatch = useAppDispatch();
  const { data, isLoading } = useZonesQuery();
  const [save, { isLoading: saving }] = useSaveZonesMutation();
  const [zones, setZones] = useState<ZoneDraft[] | null>(null);
  const [testZip, setTestZip] = useState('');
  useEffect(() => { if (data && !zones) setZones(data.map((z) => ({ ...z, prefixes: z.prefixes.join(', ') }))); }, [data, zones]);

  if (isLoading || !zones) return <Skeletons n={2} />;

  const update = (i: number, patch: Partial<ZoneDraft>) => setZones(zones.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  const parsed = (): Zone[] => zones.map((z) => ({
    ...z, name: z.name.trim() || 'Zona',
    prefixes: z.prefixes.split(/[,\s]+/).map((x) => x.replace(/\D/g, '').slice(0, 5)).filter(Boolean)
  }));
  const submit = async () => {
    try { await save(parsed()).unwrap(); dispatch(showToast('Zonas guardadas')); }
    catch (e) { dispatch(showToast(errorMessage(e))); }
  };
  const test = /^\d{5}$/.test(testZip) ? zoneForZip(parsed(), testZip) : undefined;

  return (
    <>
      <h1>Zonas de cobertura</h1>
      <p className="muted">La mensajería local solo se ofrece en los códigos postales que empiezan con estos prefijos. Ej. &quot;782&quot; cubre del 78201 al 78299.</p>
      <div className="list">{zones.map((z, i) => (
        <div className="card" key={z.id}>
          <div className="row between"><h3>Zona {i + 1}</h3>
            <label className="row small" style={{ gap: 8, fontWeight: 700 }}>{z.local ? 'Activa' : 'Apagada'}
              <span className="switch"><input type="checkbox" checked={z.local} onChange={(e) => update(i, { local: e.target.checked })} aria-label="Activar mensajería en esta zona" /><span /></span>
            </label>
          </div>
          <div className="grid2">
            <div className="stack"><label className="f" htmlFor={'zn' + i}>Nombre</label><input className="in" id={'zn' + i} value={z.name} onChange={(e) => update(i, { name: e.target.value })} /></div>
            <div className="stack"><label className="f" htmlFor={'zp' + i}>Prefijos de código postal</label><input className="in" id={'zp' + i} placeholder="782, 781" value={z.prefixes} onChange={(e) => update(i, { prefixes: e.target.value })} /></div>
          </div>
          <button className="btn sm ghost danger" style={{ alignSelf: 'flex-start' }} onClick={() => setZones(zones.filter((_, j) => j !== i))}>Quitar zona</button>
        </div>
      ))}</div>
      <div className="grid2">
        <button className="btn" onClick={() => setZones([...zones, { id: 'z' + Date.now().toString(36), name: 'Nueva zona', prefixes: '', local: true }])}><Icon name="plus" size={18} /> Agregar zona</button>
        <button className="btn primary" onClick={submit} disabled={saving}>{saving ? <span className="spin" /> : 'Guardar zonas'}</button>
      </div>
      <div className="card">
        <h3>Probar un código postal</h3>
        <input className="in" inputMode="numeric" maxLength={5} placeholder="Ej. 78209" aria-label="Código postal a probar" value={testZip} onChange={(e) => setTestZip(e.target.value.replace(/\D/g, ''))} />
        {test === undefined ? <span className="small muted">Prueba con los cambios de esta pantalla, aunque aún no los guardes.</span>
          : test ? <span className="badge b-ok" style={{ alignSelf: 'flex-start' }}>Cubierto · {test.name}</span>
          : <span className="badge b-off" style={{ alignSelf: 'flex-start' }}>Fuera de cobertura</span>}
      </div>
    </>
  );
}
