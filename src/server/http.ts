import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export const fail = (status: number, error: string, details?: unknown) =>
  NextResponse.json({ error, details }, { status });

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<{ data: z.infer<T> } | { res: NextResponse }> {
  let json: unknown;
  try { json = await req.json(); } catch { return { res: fail(400, 'El cuerpo de la petición no es JSON válido') }; }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { res: fail(422, first?.message || 'Datos inválidos', parsed.error.issues) };
  }
  return { data: parsed.data };
}

/** Protege las rutas del administrador con ADMIN_PIN (si está configurado). */
export function requireAdmin(req: Request): NextResponse | null {
  const pin = process.env.ADMIN_PIN;
  if (!pin) return null; // modo pruebas: panel abierto
  const sent = req.headers.get('x-admin-pin') || '';
  const a = Buffer.from(sent);
  const b = Buffer.from(pin);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(401, 'PIN de administrador incorrecto');
  return null;
}

export function handleError(e: unknown) {
  console.error(e);
  return fail(500, 'Algo salió mal en el servidor. Intenta de nuevo.');
}
