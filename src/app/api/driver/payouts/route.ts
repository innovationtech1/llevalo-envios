import { z } from 'zod';
import { fail, handleError, ok, parseBody } from '@/server/http';
import { requireUser, toUser } from '@/server/auth';
import { getRepo, type StoredUser } from '@/server/repo';
import type { NextResponse } from 'next/server';
import { dashboardLink, ensureConnectAccount, onboardingLink, paymentsMode, payoutsInfo } from '@/server/payments';

export const dynamic = 'force-dynamic';

type DriverGuard = { user: StoredUser; res?: undefined } | { user?: undefined; res: NextResponse };

async function driverOnly(req: Request): Promise<DriverGuard> {
  const g = await requireUser(req);
  if (g.res) return { res: g.res };
  if (g.user.driverStatus !== 'aprobado' && !g.user.isAdmin) return { res: fail(403, 'Tu cuenta de repartidor aún no está aprobada') };
  const stored = await getRepo().getUser(g.user.id);
  return stored ? { user: stored } : { res: fail(401, 'Inicia sesión para continuar') };
}

/** Estado de la cuenta de cobros del repartidor y su saldo en Stripe. */
export async function GET(req: Request) {
  const g = await driverOnly(req);
  if (g.res) return g.res;
  try {
    return ok(await payoutsInfo(g.user));
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({ action: z.enum(['acceptTerms', 'onboard', 'dashboard']) });

export async function POST(req: Request) {
  const g = await driverOnly(req);
  if (g.res) return g.res;
  const body = await parseBody(req, schema);
  if ('res' in body) return body.res;
  const origin = new URL(req.url).origin;
  try {
    switch (body.data.action) {
      case 'acceptTerms': {
        const u = await getRepo().updateUser(g.user.id, { driverTermsAt: Date.now() });
        return ok({ user: u ? toUser(u) : null });
      }
      case 'onboard': {
        if (paymentsMode() !== 'stripe') return fail(400, 'Los pagos con Stripe aún no están activados');
        if (!g.user.driverTermsAt) return fail(409, 'Primero acepta el acuerdo de repartidor');
        const accountId = await ensureConnectAccount(g.user);
        return ok({ url: await onboardingLink(accountId, origin) });
      }
      case 'dashboard': {
        if (!g.user.stripeAccountId) return fail(409, 'Aún no tienes cuenta de cobros');
        return ok({ url: await dashboardLink(g.user.stripeAccountId) });
      }
    }
  } catch (e) {
    return handleError(e);
  }
}
