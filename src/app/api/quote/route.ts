import { handleError, ok, parseBody } from '@/server/http';
import { quoteRequestSchema } from '@/server/schemas';
import { buildQuote } from '@/server/quote';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await parseBody(req, quoteRequestSchema);
  if ('res' in body) return body.res;
  try {
    const { pickup, dropoff, size } = body.data;
    return ok(await buildQuote(pickup, dropoff, size));
  } catch (e) {
    return handleError(e);
  }
}
