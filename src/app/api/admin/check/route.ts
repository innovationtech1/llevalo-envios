import { ok, requireAdmin } from '@/server/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  return denied ?? ok({ ok: true });
}
