-- Point Studio — initial Cloudflare D1 schema
-- Applies to: Cloudflare D1 (SQLite).
-- Timestamps are ISO-8601 UTC strings (e.g. 2026-01-31T12:00:00.000Z).

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL, -- JSON encoded
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS asset_meta (
  url         TEXT PRIMARY KEY,
  label       TEXT,
  alt         TEXT,
  caption     TEXT,
  description TEXT,
  tags        TEXT NOT NULL DEFAULT '[]', -- JSON array
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS media_assets (
  id                   TEXT PRIMARY KEY,
  storage_provider     TEXT NOT NULL DEFAULT 'r2',
  bucket               TEXT NOT NULL DEFAULT 'pointstudio-assets',
  object_key           TEXT NOT NULL,
  filename             TEXT NOT NULL,
  url                  TEXT NOT NULL UNIQUE,
  kind                 TEXT NOT NULL DEFAULT 'image',
  content_type         TEXT,
  size                 INTEGER,
  optimized_object_key TEXT,
  optimized_url        TEXT,
  original_object_key  TEXT,
  original_url         TEXT,
  label                TEXT,
  alt                  TEXT,
  caption              TEXT,
  description          TEXT,
  tags                 TEXT NOT NULL DEFAULT '[]', -- JSON array
  used_on_site         INTEGER NOT NULL DEFAULT 0,
  original_filename    TEXT DEFAULT '',
  mime_type            TEXT,
  media_type           TEXT DEFAULT 'file',
  width                INTEGER,
  height               INTEGER,
  duration             REAL,
  folder               TEXT DEFAULT 'uploads',
  upload_date          TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_media_assets_updated_at ON media_assets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_object_key ON media_assets(object_key);

CREATE TABLE IF NOT EXISTS galleries (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  tagline    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id             TEXT PRIMARY KEY,
  gallery_id     TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  src            TEXT NOT NULL,
  alt            TEXT,
  title          TEXT,
  position       INTEGER NOT NULL DEFAULT 0,
  media_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_gallery_images_gallery ON gallery_images(gallery_id, position);

CREATE TABLE IF NOT EXISTS menu_items (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  path       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  visible    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS pages (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  seo_title       TEXT,
  seo_description TEXT,
  body            TEXT NOT NULL DEFAULT '{}', -- JSON
  published       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS page_seo (
  path        TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT,
  keywords    TEXT,
  og_image    TEXT,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS page_views (
  id           TEXT PRIMARY KEY,
  path         TEXT NOT NULL,
  referrer     TEXT,
  user_agent   TEXT,
  session_id   TEXT,
  country      TEXT,
  city         TEXT,
  search_query TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  source_path TEXT,
  user_agent  TEXT,
  read_at     TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC);

-- Administrator accounts (replaces Supabase Auth).
-- password_hash format: pbkdf2$<iterations>$<base64 salt>$<base64 derived key>
CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Sessions store only a SHA-256 hash of the session token.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);

-- Daily AI usage counters (replaces the Supabase-backed credit counter).
CREATE TABLE IF NOT EXISTS ai_usage (
  day        TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (day, user_id)
);

-- Applied-migration bookkeeping (used by scripts/db-migrate.mjs).
CREATE TABLE IF NOT EXISTS schema_migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
