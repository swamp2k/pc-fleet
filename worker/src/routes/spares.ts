import type { Env } from '../index';
import { makeDb } from '../db';
import { json } from '../router';
import { authenticateDashboard } from '../auth';

const VALID_CONDITIONS = ['new', 'used', 'unknown'] as const;

export function makeSparesRoutes(env: Env) {
  const db = makeDb(env.DB);

  async function list(request: Request): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const parts = await db.listSpares();
    return json({ parts });
  }

  async function create(request: Request): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    let body: {
      part_type?: string; model?: string; spec_json?: string;
      condition?: string; location?: string; acquired_at?: string; notes?: string;
    };
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (!body.part_type) return json({ error: 'part_type is required' }, 400);

    const condition = body.condition ?? 'unknown';
    if (!VALID_CONDITIONS.includes(condition as typeof VALID_CONDITIONS[number])) {
      return json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` }, 400);
    }

    await db.createSpare({
      id: crypto.randomUUID(),
      part_type: body.part_type,
      model: body.model ?? null,
      spec_json: body.spec_json ?? null,
      condition,
      location: body.location ?? null,
      acquired_at: body.acquired_at ?? null,
      notes: body.notes ?? null,
    });

    return json({ ok: true }, 201);
  }

  async function update(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    let body: {
      part_type?: string; model?: string | null; spec_json?: string | null;
      condition?: string | null; location?: string | null; acquired_at?: string | null; notes?: string | null;
    };
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

    if (body.condition != null && !VALID_CONDITIONS.includes(body.condition as typeof VALID_CONDITIONS[number])) {
      return json({ error: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` }, 400);
    }

    await db.updateSpare(params.id, body);
    return json({ ok: true });
  }

  async function remove(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    await db.deleteSpare(params.id);
    return json({ ok: true });
  }

  return { list, create, update, remove };
}
