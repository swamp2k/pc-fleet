import { Router, json } from './router';
import { makeAuthRoutes } from './routes/auth';
import { makeProfileRoutes } from './routes/profiles';
import { makeSparesRoutes } from './routes/spares';
import { makeRecommendationRoutes } from './routes/recommendations';

export interface Env {
  DB: D1Database;
  DASHBOARD_JWT_SECRET: string;
  ANTHROPIC_API_KEY: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function withCors(response: Response): Response {
  const r = new Response(response.body, response);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => r.headers.set(k, v));
  return r;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const router = new Router();
    const auth = makeAuthRoutes(env);
    const profiles = makeProfileRoutes(env);
    const spares = makeSparesRoutes(env);
    const recs = makeRecommendationRoutes(env);

    router.post('/api/auth/login', req => auth.login(req));
    router.post('/api/auth/magic-link', req => auth.magicLinkRequest(req));
    router.post('/api/auth/magic-link/verify', req => auth.magicLinkVerify(req));

    router.get('/api/devices', req => profiles.listDevices(req));
    router.get('/api/devices/:id/profile', (req, p) => profiles.getProfile(req, p));
    router.put('/api/devices/:id/profile', (req, p) => profiles.upsertProfile(req, p));
    router.get('/api/devices/:id/hardware', (req, p) => profiles.getHardware(req, p));

    router.get('/api/spares', req => spares.list(req));
    router.post('/api/spares', req => spares.create(req));
    router.put('/api/spares/:id', (req, p) => spares.update(req, p));
    router.delete('/api/spares/:id', (req, p) => spares.remove(req, p));

    router.get('/api/devices/:id/recommendations', (req, p) => recs.list(req, p));
    router.post('/api/devices/:id/recommendations/generate', (req, p) => recs.generate(req, p));

    router.get('/api/health', () => Promise.resolve(json({ ok: true })));

    const response = await router.handle(request);
    return withCors(response);
  },
};
