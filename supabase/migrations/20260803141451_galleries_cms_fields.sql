-- Add CMS fields to galleries: cover image, description, SEO metadata,
-- ordering and visibility controls.

ALTER TABLE public.galleries
  ADD COLUMN IF NOT EXISTS cover_image_id  uuid         REFERENCES public.gallery_images(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description     text,
  ADD COLUMN IF NOT EXISTS subtitle        text,
  ADD COLUMN IF NOT EXISTS seo_title       varchar(80),
  ADD COLUMN IF NOT EXISTS meta_description varchar(200),
  ADD COLUMN IF NOT EXISTS sort_order      integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible         boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_nav     boolean      NOT NULL DEFAULT false;

-- Initialise sort_order for existing rows so they keep their current order
UPDATE public.galleries
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.galleries
) sub
WHERE public.galleries.id = sub.id;

-- Expose cover_image_id in existing RLS: no policy changes needed because
-- the galleries table inherits the same anon-read / admin-write policy.
-- (All policy changes for galleries were established in prior migrations.)
