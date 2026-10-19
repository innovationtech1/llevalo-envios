'use client';

import { useState, type FormEvent } from 'react';
import Icon from './Icon';
import { errorMessage, useInfoQuery, useStartLoginMutation, useVerifyLoginMutation } from '@/store/api';
import { prettyPhone } from '@/lib/constants';

/** Entrar con el teléfono: 1) escribir número, 2) escribir el código que llega por mensaje. */
export default function LoginForm({ title = 'Entra con tu teléfono', intro }: { title?: string; intro?: string }) {
  const { data: info } = useInfoQuery();
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [start, { isLoading: sending, error: startError, reset: resetStart }] = useStartLoginMutation();
  const [verify, { isLoading: checking, error: verifyError }] = useVerifyLoginMutation();

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    try { const r = await start(phone).unwrap(); setSentTo(r.phone); setCode(''); } catch { /* error abajo */ }
  };
  const check = async (e: FormEvent) => {
    e.preventDefault();
    if (sentTo) try { await verify({ phone: sentTo, code }).unwrap(); } catch { /* error abajo */ }
  };

  if (!sentTo) {
    return (
      <form className="card" onSubmit={send}>
        <h2>{title}</h2>
        {intro && <p className="small muted">{intro}</p>}
        <div className="stack">
          <label className="f" htmlFor="login-phone">Tu número de celular</label>
          <input className="in" id="login-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(210) 555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {startError && <div className="err">{errorMessage(startError)}</div>}
        <button className="btn primary block" type="submit" disabled={sending || phone.replace(/\D/g, '').length < 10}>
          {sending ? <span className="spin" /> : 'Enviarme un código'}
        </button>
        <p className="tiny muted">Te mandamos un código por mensaje de texto. Pueden aplicar cargos de tu compañía telefónica.</p>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={check}>
      <h2>Escribe el código</h2>
      <p className="small muted">Lo enviamos a <b>{prettyPhone(sentTo)}</b>.</p>
      {info?.sms === 'prueba' && (
        <div className="notice"><Icon name="info" size={18} /><span><b>Modo prueba:</b> todavía no se envían mensajes. Usa el código <b>123456</b> (el administrador usa su PIN).</span></div>
      )}
      <div className="stack">
        <label className="f" htmlFor="login-code">Código de 6 dígitos</label>
        <input className="in" id="login-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: 6, fontSize: 22, textAlign: 'center' }} />
      </div>
      {verifyError && <div className="err">{errorMessage(verifyError)}</div>}
      <button className="btn primary block" type="submit" disabled={checking || code.length < 4}>{checking ? <span className="spin" /> : 'Entrar'}</button>
      <div className="row between">
        <button type="button" className="btn sm ghost" onClick={() => { setSentTo(null); resetStart(); }}>Cambiar número</button>
        <button type="button" className="btn sm ghost" onClick={() => send()} disabled={sending}>Reenviar código</button>
      </div>
    </form>
  );
}
