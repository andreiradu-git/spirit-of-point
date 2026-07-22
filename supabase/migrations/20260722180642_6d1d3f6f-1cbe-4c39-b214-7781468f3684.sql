INSERT INTO public.galleries (slug, title, tagline)
VALUES ('services', 'What We Do', 'Homepage service categories')
ON CONFLICT (slug) DO NOTHING;

WITH g AS (
  SELECT id FROM public.galleries WHERE slug = 'services'
)
INSERT INTO public.gallery_images (gallery_id, src, alt, title, position)
SELECT
  g.id,
  v.src,
  v.alt,
  v.title,
  v.position
FROM g
CROSS JOIN (VALUES
  ('https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/225fd319-6da7-46d4-a73f-fefdaa23ef02/_C7A3526+2.jpg', 'Food photography', 'Food', 1),
  ('https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/e74d7586-4697-42f4-8d5e-2c5d437f966e/_C7A3568.jpg', 'People photography', 'People', 2),
  ('https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/5ab03dea-2051-4f1c-8399-84b65d174dc0/5af84177-a504-7df7-aa82s-209047b2bf23.jpeg', 'Editorial photography', 'Editorial', 3),
  ('https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/73250edd-405f-40ed-b6db-4e58ac7ec7f6/am.jpg', 'Corporate photography', 'Corporate', 4),
  ('https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/402ec764-68fc-4aa3-9cda-eac4c5789b3b/KFL+Smiley-+Untitled+Session59864.jpg', 'Landscape photography', 'Landscape', 5),
  ('https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/05a9eabf-7c94-413a-8694-89dbf70ad51d/6-2.jpg', 'Industrial photography', 'Industrial', 6)
) AS v(src, alt, title, position)
ON CONFLICT DO NOTHING;