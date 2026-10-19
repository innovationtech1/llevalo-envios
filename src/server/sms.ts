import 'server-only';

/**
 * Códigos de verificación por SMS con Twilio Verify.
 * Sin las variables de Twilio la app queda en "modo prueba": el código es 123456
 * (y para los teléfonos de administrador, su ADMIN_PIN si existe).
 */
const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE = process.env.TWILIO_VERIFY_SID;

export const TEST_CODE = '123456';
export const smsMode = (): 'twilio' | 'prueba' => (SID && TOKEN && SERVICE ? 'twilio' : 'prueba');

async function twilio(path: string, body: Record<string, string>) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${SERVICE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${SID}:${TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10000)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as { status?: string; message?: string; code?: number } };
}

export async function sendCode(phone: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (smsMode() === 'prueba') return { ok: true };
  const r = await twilio('Verifications', { To: phone, Channel: 'sms', Locale: 'es' });
  if (r.ok) return { ok: true };
  console.error('twilio send', r.status, r.data);
  if (r.status === 429 || r.data.code === 60203) return { ok: false, error: 'Demasiados intentos. Espera unos minutos.' };
  if (r.data.code === 60200 || r.data.code === 21211) return { ok: false, error: 'Ese número no es válido.' };
  return { ok: false, error: 'No pudimos enviar el código. Intenta de nuevo.' };
}

export async function checkCode(phone: string, code: string, isAdminPhone: boolean): Promise<boolean> {
  if (smsMode() === 'prueba') {
    const pin = process.env.ADMIN_PIN;
    return isAdminPhone && pin ? code === pin : code === TEST_CODE;
  }
  const r = await twilio('VerificationCheck', { To: phone, Code: code });
  return r.ok && r.data.status === 'approved';
}
