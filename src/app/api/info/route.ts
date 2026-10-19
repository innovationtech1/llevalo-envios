import { ok } from '@/server/http';
import { getRepo } from '@/server/repo';
import { mapsProvider } from '@/server/geo';
import type { AppInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const info: AppInfo = { demo: getRepo().demo, maps: mapsProvider(), adminPin: Boolean(process.env.ADMIN_PIN) };
  return ok(info);
}
