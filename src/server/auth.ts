import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { User } from '@/lib/types';
import { normalizePhone } from '@/lib/constants';
import { databaseUrl, getRepo, type StoredUser } from './repo';

/**
 * Sesiones con cookie firmada (HMAC-SHA256). La cookie solo guarda el id del usuario
 * y la fecha de expiración; el resto se lee de la base de datos en cada petición.
 */
export const COOKIE = 'llevalo_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

let secretCache: Buffer | null = null;
function secret(): Buffer {
  if (secretCache) return secretCache;
  const s = process.env.SESSION_SECRET;
  const db = databaseUrl();
  // Sin SESSION_SECRET se deriva de la conexión a la base (secreta y estable entre servidores).
  secretCache = s ? Buffer.from(s) : db ? createHash('sha256').update('llevalo:' + db).digest() : randomBytes(32);
  return secretCache;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signSession(userId: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ u: userId, e: Math.floor(now / 1000) + MAX_AGE }));
  const sig = b64(createHmac('sha256', secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof u === 'string' && e * 1000 > now ? u : null;
  } catch {
    return null;
  }
}

/** Teléfonos con acceso de administrador (ADMIN_PHONES, separados por comas). */
export function adminPhones(): string[] {
  return (process.env.ADMIN_PHONES || '').split(',').map((p) => normalizePhone(p)).filter((p): p is string => Boolean(p));
}
export const isAdminPhone = (phone: string) => adminPhones().includes(phone);

export const toUser = (u: StoredUser): User => ({ ...u, isAdmin: isAdminPhone(u.phone) });

function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export async function currentUser(req: Request): Promise<User | null> {
  const id = verifySession(readCookie(req, COOKIE));
  if (!id) return null;
  const u = await getRepo().getUser(id);
  return u ? toUser(u) : null;
}

export function setSessionCookie(res: NextResponse, userId: string) {
  res.cookies.set(COOKIE, signSession(userId), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}

const deny = (status: number, error: string) => NextResponse.json({ error }, { status });

type Guard = { user: User; res?: undefined } | { user?: undefined; res: NextResponse };

export async function requireUser(req: Request): Promise<Guard> {
  const user = await currentUser(req);
  return user ? { user } : { res: deny(401, 'Inicia sesión para continuar') };
}

export async function requireDriver(req: Request): Promise<Guard> {
  const g = await requireUser(req);
  if (g.res) return g;
  if (g.user.driverStatus !== 'aprobado' && !g.user.isAdmin) return { res: deny(403, 'Tu cuenta de repartidor aún no está aprobada') };
  return g;
}

/**
 * Administrador = sesión con un teléfono de ADMIN_PHONES.
 * Si ADMIN_PHONES no está configurado: en modo demo el panel queda abierto para probar;
 * con base de datos real queda cerrado hasta configurarlo.
 */
export async function requireAdmin(req: Request): Promise<Guard | { user: null; res?: undefined }> {
  if (!adminPhones().length) {
    return getRepo().demo ? { user: null } : { res: deny(403, 'Falta configurar ADMIN_PHONES en Vercel con tu número de teléfono') };
  }
  const g = await requireUser(req);
  if (g.res) return g;
  if (!g.user.isAdmin) return { res: deny(403, 'Solo el administrador puede hacer esto') };
  return g;
}
