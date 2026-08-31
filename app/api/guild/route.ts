import { env } from 'cloudflare:workers';
import { catalog } from '@/lib/catalog';
import { initialize, Problem, service } from '@/lib/service';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      throw new Problem(403, 'CROSS_ORIGIN');
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw new Problem(415, 'JSON_REQUIRED');
    const actor = request.headers.get('oai-authenticated-user-id');
    if (!actor) throw new Problem(401, 'SIGN_IN_REQUIRED');
    if (Number(request.headers.get('content-length')) > 150000)
      throw new Problem(413, 'REQUEST_TOO_LARGE');
    const reader = request.body?.getReader();
    if (!reader) throw new Problem(400, 'EMPTY_BODY');
    let size = 0,
      text = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 150000) {
        await reader.cancel();
        throw new Problem(413, 'REQUEST_TOO_LARGE');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Problem(400, 'BAD_JSON');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Problem(400, 'BAD_JSON');
    await initialize(env.DB);
    const result = await service(env.DB, actor, body, catalog);
    return Response.json(result, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const e = error as Error;
    const status =
      e instanceof Problem
        ? e.status
        : ['FORBIDDEN', 'OWNER_ONLY'].includes(e.message)
          ? 403
          : /^(BAD_|RANGE|NOT_|FINISHED|NO_UNDO|RESULT_REQUIRED)/.test(
                e.message,
              )
            ? 422
            : 500;
    if (status === 500)
      console.error('guild_request_failed', { code: e.message });
    return Response.json(
      { error: status === 500 ? 'SERVER_ERROR' : e.message },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
