-- pcfleet migration 0001

CREATE TABLE fleet_user_profiles (
  device_id TEXT PRIMARY KEY REFERENCES devices(id),
  primary_use_cases TEXT,       -- JSON array, e.g. ["gaming","video-editing"]
  performance_expectation TEXT, -- light | everyday | gaming | creative-pro
  usage_notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE fleet_spare_parts (
  id TEXT PRIMARY KEY,
  part_type TEXT NOT NULL,      -- e.g. "ram", "gpu", "psu", "storage"
  model TEXT,
  spec_json TEXT,               -- free-form specs (capacity, speed, wattage, etc.)
  condition TEXT,               -- new | used | unknown
  location TEXT,                -- where it physically is
  acquired_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE fleet_recommendations (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  generated_at TEXT NOT NULL,
  prompt_input_json TEXT,       -- snapshot of what was fed to the LLM, for debugging
  recommendation_text TEXT,
  model_used TEXT
);

CREATE INDEX idx_fleet_recommendations_device ON fleet_recommendations(device_id, generated_at);
