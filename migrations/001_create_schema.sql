-- migrations/001_create_schema.sql

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  storage_provider TEXT,
  bucket TEXT,
  object_key TEXT,
  filename TEXT,
  url TEXT UNIQUE,
  kind TEXT,
  content_type TEXT,
  size INTEGER,
  optimized_object_key TEXT,
  optimized_url TEXT,
  alt TEXT,
  used_on_site INTEGER DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  title TEXT,
  tagline TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id TEXT PRIMARY KEY,
  gallery_id TEXT,
  media_asset_id TEXT,
  src TEXT,
  alt TEXT,
  title TEXT,
  position INTEGER,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (gallery_id) REFERENCES galleries(id),
  FOREIGN KEY (media_asset_id) REFERENCES media_assets(id)
);

CREATE TABLE IF NOT EXISTS asset_meta (
  url TEXT PRIMARY KEY,
  label TEXT,
  alt TEXT,
  caption TEXT,
  description TEXT,
  tags TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT,
  created_at TEXT
);
