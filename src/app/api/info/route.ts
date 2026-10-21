import { ok } from '@/server/http';
import { getRepo } from '@/server/repo';
import { mapsProvider } from '@/server/geo';
import { paymentsMode } from '@/server/payments';
import { smsMode } from '@/server/sms';
import { adminPhones } from '@/server/auth';
import type { AppInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const info: AppInfo = {
    demo: getRepo().demo,
    maps: mapsProvider(),
    payments: paymentsMode(),
    sms: smsMode(),
    adminConfigured: adminPhones().length > 0,
    legalConfigured: Boolean(process.env.LEGAL_NAME && process.env.LEGAL_EMAIL)
  };
  return ok(info);
}
