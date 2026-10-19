import { handleError, ok, parseBody, requireAdmin } from '@/server/http';
import { settingsSchema } from '@/server/schemas';
import { getRepo } from '@/server/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return ok(await getRepo().getSettings());
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await parseBody(req, settingsSchema);
  if ('res' in body) return body.res;
  try {
    return ok(await getRepo().saveSettings({ ...body.data, edited: true }));
  } catch (e) {
    return handleError(e);
  }
}
