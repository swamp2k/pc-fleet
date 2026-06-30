-- Fleet migration 0002: link spare parts to devices + support auto-sync from pcwatch hardware inventory

ALTER TABLE fleet_spare_parts ADD COLUMN device_id TEXT;
ALTER TABLE fleet_spare_parts ADD COLUMN pcwatch_fingerprint TEXT;
ALTER TABLE fleet_spare_parts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE fleet_spare_parts ADD COLUMN last_seen_at TEXT;

-- NULLs are distinct in SQLite UNIQUE indexes, so manual parts (fingerprint=NULL) coexist freely.
CREATE UNIQUE INDEX idx_fleet_spare_parts_fingerprint
  ON fleet_spare_parts(pcwatch_fingerprint);

-- Per-device override: JSON array of component types to exclude from auto-sync.
-- e.g. ["cpu"] forces the CPU to be treated as soldered even if heuristics disagree.
ALTER TABLE fleet_user_profiles ADD COLUMN soldered_components TEXT;
