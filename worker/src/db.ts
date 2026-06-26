// pcwatch tables — SELECT only. No INSERT/UPDATE/DELETE against these from pcfleet.
// If you find yourself wanting to write to any of the tables below, stop —
// that feature belongs in pcwatch, not here.
const PCWATCH_READONLY_TABLES = [
  'devices', 'hardware_inventory', 'metrics', 'disk_metrics',
  'av_status', 'pending_updates', 'network_info', 'backup_log',
  'alerts', 'dashboard_users', 'magic_links',
] as const;

function guardReadonly(db: D1Database): D1Database {
  return new Proxy(db, {
    get(target, prop) {
      if (prop !== 'prepare') return (target as unknown as Record<string | symbol, unknown>)[prop];
      return (sql: string) => {
        const normalized = sql.trimStart().toUpperCase();
        const touchesPcwatch = PCWATCH_READONLY_TABLES.some(t =>
          new RegExp(`\\b${t}\\b`, 'i').test(sql)
        );
        if (touchesPcwatch && !normalized.startsWith('SELECT')) {
          throw new Error(`pcfleet: write attempt blocked on pcwatch table in: ${sql.slice(0, 80)}`);
        }
        return target.prepare(sql);
      };
    },
  });
}

export function makeDb(rawDb: D1Database) {
  const db = guardReadonly(rawDb);

  // ── pcwatch reads ─────────────────────────────────────────────────────────

  async function listDevices() {
    const { results } = await db.prepare(
      `SELECT id, name, owner, status, last_seen_at, notes
       FROM devices WHERE status = 'active' ORDER BY name`
    ).all<{ id: string; name: string; owner: string | null; status: string; last_seen_at: string | null; notes: string | null }>();
    return results;
  }

  async function getDevice(deviceId: string) {
    return db.prepare(
      `SELECT id, name, owner, status, last_seen_at, notes FROM devices WHERE id = ?`
    ).bind(deviceId).first<{ id: string; name: string; owner: string | null; status: string; last_seen_at: string | null; notes: string | null }>();
  }

  async function getHardware(deviceId: string) {
    return db.prepare(
      `SELECT device_id, collected_at, cpu_model, cpu_cores, cpu_threads,
              ram_total_gb, ram_modules_json, gpu_json, motherboard_model,
              bios_version, storage_devices_json
       FROM hardware_inventory WHERE device_id = ?`
    ).bind(deviceId).first();
  }

  async function getRecentMetrics(deviceId: string) {
    const { results } = await db.prepare(
      `SELECT recorded_at, cpu_pct, ram_pct, temp_c FROM metrics
       WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 5`
    ).bind(deviceId).all();
    return results;
  }

  async function getLatestDiskMetrics(deviceId: string) {
    const { results } = await db.prepare(
      `SELECT volume_label, total_gb, free_gb, used_pct FROM disk_metrics
       WHERE device_id = ? AND recorded_at = (
         SELECT MAX(recorded_at) FROM disk_metrics WHERE device_id = ?
       ) ORDER BY volume_label`
    ).bind(deviceId, deviceId).all();
    return results;
  }

  async function getAvStatus(deviceId: string) {
    return db.prepare(
      `SELECT collected_at, defender_enabled, signature_age_days, last_scan_at, third_party_av
       FROM av_status WHERE device_id = ?`
    ).bind(deviceId).first();
  }

  async function getPendingUpdates(deviceId: string) {
    return db.prepare(
      `SELECT collected_at, count, updates_json FROM pending_updates WHERE device_id = ?`
    ).bind(deviceId).first();
  }

  // ── fleet_ reads/writes ───────────────────────────────────────────────────

  async function getProfile(deviceId: string) {
    return rawDb.prepare(
      `SELECT device_id, primary_use_cases, performance_expectation, usage_notes, updated_at
       FROM fleet_user_profiles WHERE device_id = ?`
    ).bind(deviceId).first<{
      device_id: string; primary_use_cases: string | null;
      performance_expectation: string | null; usage_notes: string | null; updated_at: string;
    }>();
  }

  async function upsertProfile(deviceId: string, data: {
    primary_use_cases: string | null;
    performance_expectation: string | null;
    usage_notes: string | null;
  }) {
    const now = new Date().toISOString();
    await rawDb.prepare(
      `INSERT INTO fleet_user_profiles (device_id, primary_use_cases, performance_expectation, usage_notes, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         primary_use_cases = excluded.primary_use_cases,
         performance_expectation = excluded.performance_expectation,
         usage_notes = excluded.usage_notes,
         updated_at = excluded.updated_at`
    ).bind(deviceId, data.primary_use_cases, data.performance_expectation, data.usage_notes, now).run();
  }

  async function listSpares() {
    const { results } = await rawDb.prepare(
      `SELECT id, part_type, model, spec_json, condition, location, acquired_at, notes, created_at
       FROM fleet_spare_parts ORDER BY part_type, model`
    ).all();
    return results;
  }

  async function createSpare(data: {
    id: string; part_type: string; model: string | null; spec_json: string | null;
    condition: string | null; location: string | null; acquired_at: string | null; notes: string | null;
  }) {
    const now = new Date().toISOString();
    await rawDb.prepare(
      `INSERT INTO fleet_spare_parts (id, part_type, model, spec_json, condition, location, acquired_at, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(data.id, data.part_type, data.model, data.spec_json, data.condition, data.location, data.acquired_at, data.notes, now).run();
  }

  async function updateSpare(id: string, data: {
    part_type?: string; model?: string | null; spec_json?: string | null;
    condition?: string | null; location?: string | null; acquired_at?: string | null; notes?: string | null;
  }) {
    await rawDb.prepare(
      `UPDATE fleet_spare_parts SET
         part_type  = COALESCE(?, part_type),
         model      = ?,
         spec_json  = ?,
         condition  = ?,
         location   = ?,
         acquired_at = ?,
         notes      = ?
       WHERE id = ?`
    ).bind(
      data.part_type ?? null, data.model ?? null, data.spec_json ?? null,
      data.condition ?? null, data.location ?? null, data.acquired_at ?? null,
      data.notes ?? null, id,
    ).run();
  }

  async function deleteSpare(id: string) {
    await rawDb.prepare(`DELETE FROM fleet_spare_parts WHERE id = ?`).bind(id).run();
  }

  async function listRecommendations(deviceId: string) {
    const { results } = await rawDb.prepare(
      `SELECT id, device_id, generated_at, recommendation_text, model_used
       FROM fleet_recommendations WHERE device_id = ? ORDER BY generated_at DESC LIMIT 20`
    ).bind(deviceId).all();
    return results;
  }

  async function saveRecommendation(data: {
    id: string; device_id: string; prompt_input_json: string;
    recommendation_text: string; model_used: string;
  }) {
    const now = new Date().toISOString();
    await rawDb.prepare(
      `INSERT INTO fleet_recommendations (id, device_id, generated_at, prompt_input_json, recommendation_text, model_used)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(data.id, data.device_id, now, data.prompt_input_json, data.recommendation_text, data.model_used).run();
  }

  // ── auth (reads from dashboard_users, magic_links — via guard so SELECT-only) ──

  async function getUserByEmail(email: string) {
    return db.prepare(
      `SELECT id, password_hash FROM dashboard_users WHERE email = ?`
    ).bind(email).first<{ id: string; password_hash: string | null }>();
  }

  async function updateLastLogin(userId: string) {
    await rawDb.prepare(
      `UPDATE dashboard_users SET last_login_at = ? WHERE id = ?`
    ).bind(new Date().toISOString(), userId).run();
  }

  async function getUserById(userId: string) {
    return db.prepare(
      `SELECT id FROM dashboard_users WHERE id = ?`
    ).bind(userId).first<{ id: string }>();
  }

  async function insertMagicLink(tokenHash: string, userId: string, expiresAt: string) {
    await rawDb.prepare(
      `INSERT INTO magic_links (token_hash, user_id, expires_at) VALUES (?, ?, ?)`
    ).bind(tokenHash, userId, expiresAt).run();
  }

  async function getMagicLink(tokenHash: string) {
    return db.prepare(
      `SELECT user_id, expires_at, used_at FROM magic_links WHERE token_hash = ?`
    ).bind(tokenHash).first<{ user_id: string; expires_at: string; used_at: string | null }>();
  }

  async function consumeMagicLink(tokenHash: string, userId: string) {
    const now = new Date().toISOString();
    await rawDb.batch([
      rawDb.prepare(`UPDATE magic_links SET used_at = ? WHERE token_hash = ?`).bind(now, tokenHash),
      rawDb.prepare(`UPDATE dashboard_users SET last_login_at = ? WHERE id = ?`).bind(now, userId),
    ]);
  }

  return {
    listDevices, getDevice, getHardware, getRecentMetrics, getLatestDiskMetrics,
    getAvStatus, getPendingUpdates,
    getProfile, upsertProfile,
    listSpares, createSpare, updateSpare, deleteSpare,
    listRecommendations, saveRecommendation,
    getUserByEmail, updateLastLogin, getUserById,
    insertMagicLink, getMagicLink, consumeMagicLink,
  };
}

export type Db = ReturnType<typeof makeDb>;
