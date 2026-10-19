import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fail, handleError, parseBody } from '@/server/http';
import { checkCode } from '@/server/sms';
import { isAdminPhone, setSessionCookie, toUser } from '@/server/auth';
import { getRepo } from '@/server/repo';
import { normalizePhone } from '@/lib/constants';

export const dynamic = 'force-dynamic';

// Intentos fallidos por teléfono (por instancia): máximo 6 cada 15 minutos.
const g = globalThis as unknown as { __llevaloFails?: Map<string, { n: number; t: number }> };
const fails = (g.__llevaloFails ??= new Map());

export async function POST(req: Request) {
  const body = await parseBody(req, z.object({ phone: z.string().max(30), code: z.string().trim().regex(/^\d{4,8}$/, 'El código son solo números') }));
  if ('res' in body) return body.res;
  const phone = normalizePhone(body.data.phone);
  if (!phone) return fail(422, 'Teléfono inválido');

  const f = fails.get(phone);
  if (f && f.n >= 6 && Date.now() - f.t < 15 * 60_000) return fail(429, 'Demasiados intentos. Espera 15 minutos.');

  try {
    const valid = await checkCode(phone, body.data.code, isAdminPhone(phone));
    if (!valid) {
      fails.set(phone, { n: (f && Date.now() - f.t < 15 * 60_000 ? f.n : 0) + 1, t: Date.now() });
      return fail(401, 'Código incorrecto o vencido');
    }
    fails.delete(phone);
    const repo = getRepo();
    const stored = (await repo.getUserByPhone(phone)) ?? (await repo.createUser(phone, ''));
    return setSessionCookie(NextResponse.json(toUser(stored)), stored.id);
  } catch (e) {
    return handleError(e);
  }
}
