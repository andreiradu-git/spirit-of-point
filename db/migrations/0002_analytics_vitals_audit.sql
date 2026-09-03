-- Point Studio — first-party analytics, Web Vitals and storage audit logging.
ALTER TABLE page_views ADD COLUMN lang TEXT;
ALTER TABLE page_views ADD COLUMN device TEXT;

CREATE TABLE IF NOT EXISTS web_vitals (
  id         TEXT PRIMARY KEY,
  path       TEXT NOT NULL,
  lang       TEXT,
  metric     TEXT NOT NULL,
  value      REAL NOT NULL,
  rating     TEXT,
  device     TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_web_vitals_created ON web_vitals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_metric ON web_vitals(metric, created_at DESC);

CREATE TABLE IF NOT EXISTS storage_audit_log (
  id             TEXT PRIMARY KEY,
  admin_email    TEXT,
  object_key     TEXT NOT NULL,
  size           INTEGER,
  classification TEXT,
  reason         TEXT,
  action         TEXT NOT NULL DEFAULT 'delete',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_storage_audit_created ON storage_audit_log(created_at DESC);
