ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS duration numeric,
  ADD COLUMN IF NOT EXISTS folder text,
  ADD COLUMN IF NOT EXISTS upload_date timestamp with time zone;

UPDATE public.media_assets
SET
  original_filename = COALESCE(original_filename, filename),
  mime_type = COALESCE(mime_type, content_type),
  media_type = COALESCE(media_type, kind),
  folder = COALESCE(folder, NULLIF(split_part(object_key, '/', 1), ''), storage_provider),
  upload_date = COALESCE(upload_date, created_at),
  updated_at = now()
WHERE original_filename IS NULL
   OR mime_type IS NULL
   OR media_type IS NULL
   OR folder IS NULL
   OR upload_date IS NULL;

ALTER TABLE public.media_assets
  ALTER COLUMN original_filename SET DEFAULT '',
  ALTER COLUMN media_type SET DEFAULT 'file',
  ALTER COLUMN folder SET DEFAULT 'uploads',
  ALTER COLUMN upload_date SET DEFAULT now();