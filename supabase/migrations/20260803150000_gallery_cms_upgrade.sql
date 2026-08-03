ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS description_html text,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS cover_image_id uuid,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_service boolean NOT NULL DEFAULT true;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, slug) AS rn
  FROM public.galleries
)
UPDATE public.galleries g
SET position = ordered.rn
FROM ordered
WHERE g.id = ordered.id
  AND COALESCE(g.position, 0) = 0;

UPDATE public.galleries
SET is_service = false
WHERE slug IN ('hero', 'studio', 'services');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'galleries_cover_image_id_fkey'
      AND conrelid = 'public.galleries'::regclass
  ) THEN
    ALTER TABLE public.galleries
      ADD CONSTRAINT galleries_cover_image_id_fkey
      FOREIGN KEY (cover_image_id)
      REFERENCES public.gallery_images(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_galleries_position ON public.galleries(position);
CREATE INDEX IF NOT EXISTS idx_galleries_visibility ON public.galleries(visible, is_service);
