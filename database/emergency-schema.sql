CREATE TABLE IF NOT EXISTS emergency_calls (
  id TEXT PRIMARY KEY,
  call_number TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  caller_name TEXT NOT NULL,
  caller_phone TEXT NOT NULL,
  caller_player_id TEXT,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  location_description TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  z DOUBLE PRECISION NOT NULL DEFAULT 0,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_attente',
  resolved_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_calls(status);

CREATE TABLE IF NOT EXISTS emergency_units (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES emergency_calls(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  assigned_at BIGINT NOT NULL,
  responder_player_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_units_call ON emergency_units(call_id);

CREATE TABLE IF NOT EXISTS coroner_bodies (
  id TEXT PRIMARY KEY,
  victim_name TEXT NOT NULL,
  victim_player_id TEXT,
  time_of_death BIGINT NOT NULL,
  cause_of_death TEXT NOT NULL,
  is_bagged BOOLEAN NOT NULL DEFAULT false,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  z DOUBLE PRECISION NOT NULL DEFAULT 0,
  inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_tagged BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS autopsies (
  id TEXT PRIMARY KEY,
  body_id TEXT NOT NULL,
  cause TEXT NOT NULL,
  tox_screen TEXT NOT NULL,
  verdict TEXT NOT NULL,
  performed_at BIGINT NOT NULL,
  coroner_id TEXT
);