ALTER TABLE public.asset_meta
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';