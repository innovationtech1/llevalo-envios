import { z } from 'zod';
import { fail, handleError, ok, parseBody } from '@/server/http';
import { sendCode, smsMode } from '@/server/sms';
import { normalizePhone } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Límite sencillo por instancia: un código cada 30 s por teléfono (Twilio aplica sus propios límites).
const g = globalThis as unknown as { __llevaloLastSms?: Map<string, number> };
const last = (g.__llevaloLastSms ??= new Map());

export async function POST(req: Request) {
  const body = await parseBody(req, z.object({ phone: z.string().max(30) }));
  if ('res' in body) return body.res;
  const phone = normalizePhone(body.data.phone);
  if (!phone) return fail(422, 'Escribe un teléfono de EE. UU. de 10 dígitos');
  const prev = last.get(phone) ?? 0;
  if (Date.now() - prev < 30_000) return fail(429, 'Espera unos segundos antes de pedir otro código');
  try {
    const r = await sendCode(phone);
    if (!r.ok) return fail(502, r.error);
    last.set(phone, Date.now());
    return ok({ phone, mode: smsMode() });
  } catch (e) {
    return handleError(e);
  }
}
