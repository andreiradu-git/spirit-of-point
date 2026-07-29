ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS extension text,
  ADD COLUMN IF NOT EXISTS optimized_size bigint,
  ADD COLUMN IF NOT EXISTS optimized_updated_at timestamptz;

UPDATE public.media_assets
SET
  extension = COALESCE(extension, NULLIF(SUBSTRING(filename FROM '[^.]+$'), ''))
WHERE extension IS NULL;
