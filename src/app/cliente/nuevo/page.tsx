'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppShell, { BackHeader } from '@/components/AppShell';
import AddressPicker from '@/components/AddressPicker';
import AuthGate from '@/components/AuthGate';
import Icon from '@/components/Icon';
import { errorMessage, useCreateOrderMutation, useInfoQuery, useQuoteQuery, useSettingsQuery } from '@/store/api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { prefillContact, resetDraft, setField, setPlace, setSize, setWhen } from '@/store/draftSlice';
import { showToast } from '@/store/uiSlice';
import { SIZES, prettyPhone, sizeLabel } from '@/lib/constants';
import { money } from '@/lib/format';
import type { User } from '@/lib/types';

export default function NewOrderPage() {
  return (
    <AppShell role="cliente">
      <BackHeader href="/cliente" title="Mensajería local" />
      <AuthGate intro="Entra con tu número para pedir un envío y seguirlo en vivo.">{(user) => <NewOrder user={user} />}</AuthGate>
    </AppShell>
  );
}

function NewOrder({ user }: { user: User }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const d = useAppSelector((s) => s.draft);
  const { data: settings } = useSettingsQuery();
  const { data: info } = useInfoQuery();
  const both = Boolean(d.pickup && d.dropoff);
  const { data: q, isFetching: quoting, error: quoteError } = useQuoteQuery(
    { pickup: d.pickup!, dropoff: d.dropoff!, size: d.size },
    { skip: !both }
  );
  const [createOrder, { isLoading: sending }] = useCreateOrderMutation();
  const [redirecting, setRedirecting] = useState(false);
  const card = info?.payments === 'stripe';

  useEffect(() => { dispatch(prefillContact({ name: user.name })); }, [user.name, dispatch]);

  const field = (f: 'scheduledAt' | 'senderName' | 'recName' | 'recPhone' | 'notes') => ({
    value: d[f],
    onChange: (e: { target: { value: string } }) => dispatch(setField({ field: f, value: e.target.value }))
  });

  const problems = q?.problems ?? [];
  const busy = sending || redirecting;
  const ready = both && q && !quoting && !problems.length && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !d.pickup || !d.dropoff) return;
    if (!d.senderName.trim()) { dispatch(showToast('Escribe tu nombre')); return; }
    if (d.when === 'prog' && !d.scheduledAt) { dispatch(showToast('Elige día y hora')); return; }
    try {
      const r = await createOrder({ ...d, pickup: d.pickup, dropoff: d.dropoff }).unwrap();
      dispatch(resetDraft());
      if (r.checkoutUrl) {
        setRedirecting(true);
        window.location.assign(r.checkoutUrl); // página de pago segura de Stripe
        return;
      }
      dispatch(showToast(r.error ?? 'Pedido confirmado. Buscando repartidor…'));
      router.push(`/cliente/envios/${r.order.id}`);
    } catch (err) {
      dispatch(showToast(errorMessage(err, 'No se pudo crear el pedido')));
    }
  };

  const missing = !d.pickup && !d.dropoff ? 'las dos direcciones' : !d.pickup ? 'la dirección de recolección' : 'la dirección de entrega';

  return (
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
          <div className="stack"><span className="f">Tu teléfono</span><div className="in" style={{ display: 'flex', alignItems: 'center', background: 'var(--ground)' }}>{prettyPhone(user.phone)}</div></div>
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
          : <div className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>Falta elegir {missing}.</div>}
        <button className="btn primary block" type="submit" disabled={!ready}>
          {busy ? <span className="spin" /> : ready && q ? `${card ? 'Pagar' : 'Confirmar pedido'} · ${money(q.quote.total)}` : card ? 'Pagar' : 'Confirmar pedido'}
        </button>
        <div className="tiny muted" style={{ textAlign: 'center' }}>
          {card ? 'Pago seguro con tarjeta (Stripe). Si cancelas antes de que lo acepten, te devolvemos el dinero.' : 'Pagas al repartidor cuando entregue.'}
        </div>
      </div>
    </form>
  );
}
