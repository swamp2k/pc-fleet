import type { Env } from '../index';
import { makeDb } from '../db';
import { json } from '../router';
import { hashToken, signJwt, hashPassword, verifyPassword } from '../auth';

const SESSION_TTL = 7 * 24 * 60 * 60;
const MAGIC_LINK_TTL = 15 * 60;

export function makeAuthRoutes(env: Env) {
  const db = makeDb(env.DB);

  async function login(request: Request): Promise<Response> {
    let body: { email?: string; password?: string };
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (!body.email || !body.password) return json({ error: 'missing fields' }, 400);

    const user = await db.getUserByEmail(body.email);
    if (!user || !user.password_hash) return json({ error: 'invalid credentials' }, 401);

    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) return json({ error: 'invalid credentials' }, 401);

    await db.updateLastLogin(user.id);
    const token = await signJwt({ sub: user.id }, env.DASHBOARD_JWT_SECRET, SESSION_TTL);
    return json({ token });
  }

  async function magicLinkRequest(request: Request): Promise<Response> {
    let body: { email?: string };
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (!body.email) return json({ error: 'missing email' }, 400);

    const user = await db.getUserByEmail(body.email);
    if (!user) return json({ ok: true }); // silent — don't reveal existence

    const rawToken = crypto.randomUUID();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL * 1000).toISOString();
    await db.insertMagicLink(tokenHash, user.id, expiresAt);

    // In production, send this via email. For now, log it.
    console.log(`[magic-link] user=${user.id} token=${rawToken}`);
    return json({ ok: true });
  }

  async function magicLinkVerify(request: Request): Promise<Response> {
    let body: { token?: string };
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
    if (!body.token) return json({ error: 'missing token' }, 400);

    const tokenHash = await hashToken(body.token);
    const row = await db.getMagicLink(tokenHash);
    if (!row) return json({ error: 'invalid token' }, 401);
    if (row.used_at) return json({ error: 'token already used' }, 401);
    if (new Date(row.expires_at) < new Date()) return json({ error: 'token expired' }, 401);

    await db.consumeMagicLink(tokenHash, row.user_id);
    const sessionToken = await signJwt({ sub: row.user_id }, env.DASHBOARD_JWT_SECRET, SESSION_TTL);
    return json({ token: sessionToken });
  }

  return { login, magicLinkRequest, magicLinkVerify };
}

// Re-export hashPassword so it can be used in a one-off setup script if needed.
export { hashPassword };
