import type { Env } from '../index';
import { makeDb } from '../db';
import { json } from '../router';
import { authenticateDashboard } from '../auth';

const VALID_PERF_EXPECTATIONS = ['light', 'everyday', 'gaming', 'creative-pro'] as const;
type PerfExpectation = typeof VALID_PERF_EXPECTATIONS[number];

export function makeProfileRoutes(env: Env) {
  const db = makeDb(env.DB);

  async function listDevices(request: Request): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const devices = await db.listDevices();
    return json({ devices });
  }

  async function getProfile(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const device = await db.getDevice(params.id);
    if (!device) return json({ error: 'device not found' }, 404);

    const profile = await db.getProfile(params.id);
    return json({
      device,
      profile: profile ? {
        ...profile,
        primary_use_cases: profile.primary_use_cases ? JSON.parse(profile.primary_use_cases) : [],
      } : null,
    });
  }

  async function upsertProfile(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const device = await db.getDevice(params.id);
    if (!device) return json({ error: 'device not found' }, 404);

    let body: {
      primary_use_cases?: string[];
      performance_expectation?: string;
      usage_notes?: string;
    };
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

    if (body.performance_expectation != null &&
      !VALID_PERF_EXPECTATIONS.includes(body.performance_expectation as PerfExpectation)) {
      return json({ error: `performance_expectation must be one of: ${VALID_PERF_EXPECTATIONS.join(', ')}` }, 400);
    }

    await db.upsertProfile(params.id, {
      primary_use_cases: body.primary_use_cases ? JSON.stringify(body.primary_use_cases) : null,
      performance_expectation: (body.performance_expectation as PerfExpectation) ?? null,
      usage_notes: body.usage_notes ?? null,
    });

    return json({ ok: true });
  }

  async function getHardware(request: Request, params: Record<string, string>): Promise<Response> {
    const auth = await authenticateDashboard(request, env);
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const device = await db.getDevice(params.id);
    if (!device) return json({ error: 'device not found' }, 404);

    const hardware = await db.getHardware(params.id);
    return json({ hardware: hardware ?? null });
  }

  return { listDevices, getProfile, upsertProfile, getHardware };
}
