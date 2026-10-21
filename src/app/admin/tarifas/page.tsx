'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AppShell from '@/components/AppShell';
import AdminGate from '@/components/AdminGate';
import { Skeletons } from '@/components/orders';
import { errorMessage, useSaveSettingsMutation, useSettingsQuery } from '@/store/api';
import { useAppDispatch } from '@/store/hooks';
import { showToast } from '@/store/uiSlice';
import { SIZES } from '@/lib/constants';
import { quote } from '@/lib/pricing';
import { money } from '@/lib/format';
import type { Settings, SizeId } from '@/lib/types';

export default function RatesPage() {
  return <AppShell role="admin" wide><AdminGate><Rates /></AdminGate></AppShell>;
}

type Form = Record<string, string>;
const toForm = (s: Settings): Form => ({
  base: String(s.base), perMile: String(s.perMile), minimum: String(s.minimum),
  driverBase: String(s.driverBase), driverPerMile: String(s.driverPerMile), maxMiles: String(s.maxMiles),
  cancelFee: String(s.cancelFee), coverageMax: String(s.coverageMax), instantPayouts: s.instantPayouts ? '1' : '',
  ...Object.fromEntries(SIZES.map((z) => ['ex_' + z.id, String(s.extras[z.id] ?? 0)]))
});
const num = (v: string) => Math.max(0, Number(v) || 0);
const fromForm = (f: Form): Omit<Settings, 'edited'> => ({
  base: num(f.base), perMile: num(f.perMile), minimum: num(f.minimum),
  driverBase: num(f.driverBase), driverPerMile: num(f.driverPerMile), maxMiles: num(f.maxMiles) || 30,
  cancelFee: num(f.cancelFee), coverageMax: num(f.coverageMax), instantPayouts: Boolean(f.instantPayouts),
  extras: Object.fromEntries(SIZES.map((z) => [z.id, num(f['ex_' + z.id])])) as Record<SizeId, number>
});

/** Comisiones aproximadas de Stripe por envío pagado con tarjeta. */
function stripeFees(total: number, driverPay: number, instant: boolean) {
  const card = total * 0.029 + 0.3;
  const payout = driverPay * 0.0025 + 0.25;
  const inst = instant ? driverPay * 0.01 : 0;
  return Math.round((card + payout + inst) * 100) / 100;
}

function Rates() {
  const dispatch = useAppDispatch();
  const { data, isLoading } = useSettingsQuery();
  const [save, { isLoading: saving }] = useSaveSettingsMutation();
  const [f, setF] = useState<Form | null>(null);
  useEffect(() => { if (data && !f) setF(toForm(data)); }, [data, f]);

  // Vista previa en vivo mientras escribes.
  const preview = useMemo(() => f && [2, 5, 10, 15].map((mi) => ({ mi, q: quote({ ...fromForm(f), edited: true }, mi, 'pequeno') })), [f]);

  if (isLoading || !f) return <Skeletons n={3} />;

  const field = (name: string, label: string, step = '0.05', prefix = '$') => (
    <div className="stack">
      <label className="f" htmlFor={'f-' + name}>{label}</label>
      <div className="in-row" style={{ alignItems: 'center', gap: 6 }}>
        {prefix && <span className="muted">{prefix}</span>}
        <input className="in" id={'f-' + name} type="number" inputMode="decimal" min="0" step={step} value={f[name]} onChange={(e) => setF({ ...f, [name]: e.target.value })} />
      </div>
    </div>
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await save(fromForm(f)).unwrap(); dispatch(showToast('Tarifas guardadas')); }
    catch (err) { dispatch(showToast(errorMessage(err))); }
  };

  return (
    <>
      <h1>Tarifas</h1>
      <p className="muted">Precio al cliente = tarifa base + millas × precio por milla + extra por tamaño (nunca menos del mínimo).</p>
      <form className="stack" style={{ gap: 16 }} onSubmit={submit}>
        <div className="card"><h3>Lo que cobras al cliente</h3><div className="grid3">{field('base', 'Tarifa base')}{field('perMile', 'Por milla')}{field('minimum', 'Precio mínimo')}</div></div>
        <div className="card"><h3>Extra por tamaño</h3><div className="grid2">{SIZES.map((z) => <div key={z.id}>{field('ex_' + z.id, z.label)}</div>)}</div></div>
        <div className="card"><h3>Lo que le pagas al repartidor</h3><div className="grid2">{field('driverBase', 'Base por envío')}{field('driverPerMile', 'Por milla')}</div></div>
        <div className="card"><h3>Reglas</h3>
          <div className="grid3">
            {field('maxMiles', 'Distancia máxima (millas)', '1', '')}
            {field('cancelFee', 'Cargo por cancelar después de aceptado')}
            {field('coverageMax', 'Cobertura máxima por paquete', '1')}
          </div>
          <p className="tiny muted">El cargo de cancelación se le paga al repartidor que ya iba en camino. La cobertura es lo máximo que pagas si un paquete se pierde o daña (aparece en los Términos).</p>
        </div>
        <div className="card">
          <div className="row between">
            <div className="stack" style={{ gap: 2 }}><h3>Pago instantáneo al repartidor</h3>
              <span className="small muted">Al entregar, el dinero llega a su tarjeta de débito en ~30 min. Stripe te cobra 1% del pago. Si lo apagas, le llega en el depósito diario (1–2 días hábiles).</span></div>
            <span className="switch"><input type="checkbox" checked={Boolean(f.instantPayouts)} onChange={(e) => setF({ ...f, instantPayouts: e.target.checked ? '1' : '' })} aria-label="Pago instantáneo al repartidor" /><span /></span>
          </div>
        </div>
        <button className="btn primary block" type="submit" disabled={saving}>{saving ? <span className="spin" /> : 'Guardar tarifas'}</button>
      </form>
      <div className="card">
        <h3>Así quedan los precios (paquete pequeño)</h3>
        <div className="table-wrap"><table style={{ minWidth: 420 }}>
          <thead><tr><th>Millas</th><th>Cliente paga</th><th>Repartidor</th><th>Comisiones Stripe*</th><th>Te queda</th></tr></thead>
          <tbody>{preview!.map(({ mi, q }) => {
            const fees = stripeFees(q.total, q.driverPay, Boolean(f.instantPayouts));
            return <tr key={mi}><td>{mi} mi</td><td><b>{money(q.total)}</b></td><td>{money(q.driverPay)}</td><td>{money(fees)}</td><td><b>{money(q.total - q.driverPay - fees)}</b></td></tr>;
          })}</tbody>
        </table></div>
        <p className="tiny muted">*Estimado: tarjeta 2.9% + 30¢, pago al repartidor 0.25% + 25¢{f.instantPayouts ? ', pago instantáneo 1%' : ''}. Más $2 al mes por cada repartidor que reciba pagos ese mes. Antes de seguro, impuestos y otros gastos.</p>
      </div>
    </>
  );
}
