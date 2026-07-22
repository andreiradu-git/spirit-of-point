-- Insert the homepage hero gallery
INSERT INTO public.galleries (slug, title, tagline)
VALUES ('hero', 'Homepage Hero', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Insert the fish hero image
WITH gallery AS (
  SELECT id FROM public.galleries WHERE slug = 'hero'
)
INSERT INTO public.gallery_images (gallery_id, src, alt, position)
SELECT gallery.id,
  'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/62d173eb-85c8-4aca-931b-08ccf9b0bb78/aqw.png',
  'Point Studio food photography',
  1
FROM gallery
WHERE NOT EXISTS (
  SELECT 1 FROM public.gallery_images gi
  JOIN public.galleries g ON gi.gallery_id = g.id
  WHERE g.slug = 'hero'
);