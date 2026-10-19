'use client';

import { useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { BackHeader } from '@/components/AppShell';
import AddressPicker from '@/components/AddressPicker';
import Icon from '@/components/Icon';
import { errorMessage, useCreateOrderMutation, useQuoteQuery, useSettingsQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { prefillContact, resetDraft, setField, setPlace, setSize, setWhen } from '@/store/draftSlice';
import { setProfile } from '@/store/sessionSlice';
import { showToast } from '@/store/uiSlice';
import { SIZES, sizeLabel } from '@/lib/constants';
import { money } from '@/lib/format';

export default function NewOrder() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const d = useAppSelector((s) => s.draft);
  const session = useAppSelector((s) => s.session);
  const { data: settings } = useSettingsQuery();
  const both = Boolean(d.pickup && d.dropoff);
  const { data: q, isFetching: quoting, error: quoteError } = useQuoteQuery(
    { pickup: d.pickup!, dropoff: d.dropoff!, size: d.size },
    { skip: !both }
  );
  const [createOrder, { isLoading: sending }] = useCreateOrderMutation();

  useEffect(() => {
    if (session.hydrated) dispatch(prefillContact({ name: session.name, phone: session.phone }));
  }, [session.hydrated, session.name, session.phone, dispatch]);

  const field = (f: 'scheduledAt' | 'senderName' | 'senderPhone' | 'recName' | 'recPhone' | 'notes') => ({
    value: d[f],
    onChange: (e: { target: { value: string } }) => dispatch(setField({ field: f, value: e.target.value }))
  });

  const problems = q?.problems ?? [];
  const ready = both && q && !quoting && !problems.length && !sending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !d.pickup || !d.dropoff) return;
    if (!d.senderName.trim() || !d.senderPhone.trim()) { dispatch(showToast('Escribe tu nombre y teléfono')); return; }
    if (d.when === 'prog' && !d.scheduledAt) { dispatch(showToast('Elige día y hora')); return; }
    try {
      const order = await createOrder({ ...d, pickup: d.pickup, dropoff: d.dropoff }).unwrap();
      dispatch(setProfile({ name: d.senderName, phone: d.senderPhone }));
      dispatch(resetDraft());
      dispatch(showToast('Pedido confirmado. Buscando repartidor…'));
      router.push(`/cliente/envios/${order.id}`);
    } catch (err) {
      dispatch(showToast(errorMessage(err, 'No se pudo crear el pedido')));
    }
  };

  return (
    <AppShell role="cliente">
      <BackHeader href="/cliente" title="Mensajería local" />
      <form className="stack" style={{ gap: 16 }} onSubmit={submit} noValidate>
        <div className="card">
          <AddressPicker id="q-pickup" label="Recoger en" marker="dot" value={d.pickup} onChange={(place) => dispatch(setPlace({ field: 'pickup', place }))} />
          <AddressPicker id="q-dropoff" label="Entregar en" marker="sq" value={d.dropoff} onChange={(place) => dispatch(setPlace({ field: 'dropoff', place }))} />
        </div>

        <div className="stack">
          <div className="eyebrow">Tamaño del paquete</div>
          <div className="grid2">
            {SIZES.map((s) => (
              <button key={s.id} type="button" className="choice" aria-pressed={d.size === s.id} onClick={() => dispatch(setSize(s.id))}>
                <b>{s.label}</b><span>{s.hint}{settings?.extras[s.id] ? ` · +${money(settings.extras[s.id])}` : ''}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="eyebrow">¿Cuándo?</div>
          <div className="grid2">
            <button type="button" className="choice" aria-pressed={d.when === 'ahora'} onClick={() => dispatch(setWhen('ahora'))}><b>Ahora</b><span>Lo antes posible</span></button>
            <button type="button" className="choice" aria-pressed={d.when === 'prog'} onClick={() => dispatch(setWhen('prog'))}><b>Programar</b><span>Elige día y hora</span></button>
          </div>
          {d.when === 'prog' && <>
            <label className="f" htmlFor="sched">Día y hora de recolección</label>
            <input className="in" id="sched" type="datetime-local" {...field('scheduledAt')} />
          </>}
        </div>

        <div className="card">
          <div className="eyebrow">Contacto</div>
          <div className="grid2">
            <div className="stack"><label className="f" htmlFor="sn">Tu nombre</label><input className="in" id="sn" autoComplete="name" {...field('senderName')} /></div>
            <div className="stack"><label className="f" htmlFor="sp">Tu teléfono</label><input className="in" id="sp" type="tel" autoComplete="tel" {...field('senderPhone')} /></div>
            <div className="stack"><label className="f" htmlFor="rn">Quién recibe</label><input className="in" id="rn" {...field('recName')} /></div>
            <div className="stack"><label className="f" htmlFor="rp">Teléfono de quien recibe</label><input className="in" id="rp" type="tel" {...field('recPhone')} /></div>
          </div>
          <div className="stack"><label className="f" htmlFor="nt">Notas para el repartidor (opcional)</label><input className="in" id="nt" placeholder="Ej. tocar el timbre, frágil" {...field('notes')} /></div>
        </div>

        {problems.length > 0 && <div className="notice"><Icon name="info" size={18} /><div>{problems.map((p) => <div key={p}>{p}</div>)}</div></div>}

        <div className="quote">
          {quoting ? <div className="row small muted"><span className="spin" /> Calculando millas…</div>
            : quoteError ? <div className="err">{errorMessage(quoteError, 'No pudimos calcular el precio')}</div>
            : q ? <>
                <div className="row between" style={{ alignItems: 'flex-end' }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="small muted">{q.route.miles} mi · ~{q.route.minutes} min{q.route.approx ? ' (aprox.)' : ''}</span>
                    <span className="big">{money(q.quote.total)}</span>
                  </div>
                  <span className="badge b-acc">{sizeLabel(d.size)}</span>
                </div>
                <div className="breakdown">
                  <div><span>Tarifa base</span><span>{money(q.quote.base)}</span></div>
                  <div><span>{q.route.miles} mi × {money(settings?.perMile)}</span><span>{money(q.quote.byMiles)}</span></div>
                  {q.quote.extra > 0 && <div><span>Extra por tamaño</span><span>{money(q.quote.extra)}</span></div>}
                  {q.quote.minimumApplied && <div><span>Se aplicó el mínimo</span><span>{money(settings?.minimum)}</span></div>}
                </div>
              </>
            : <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Falta confirmar {!d.pickup && !d.dropoff ? 'las dos direcciones' : !d.pickup ? 'la dirección de recolección' : 'la dirección de entrega'}: escríbela, toca &quot;Buscar&quot; y elige una opción de la lista.
              </div>}
          {ready && (!d.senderName.trim() || !d.senderPhone.trim()) && <div className="small muted">Escribe tu nombre y teléfono en Contacto.</div>}
          <button className="btn primary block" type="submit" disabled={!ready}>
            {sending ? <span className="spin" /> : ready && q ? `Confirmar pedido · ${money(q.quote.total)}` : 'Confirmar pedido'}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
