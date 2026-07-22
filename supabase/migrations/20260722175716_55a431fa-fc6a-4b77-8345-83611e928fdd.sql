-- Insert the homepage studio gallery
INSERT INTO public.galleries (slug, title, tagline)
VALUES ('studio', 'The Studio', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Insert the 10 studio images from home.json
WITH gallery AS (
  SELECT id FROM public.galleries WHERE slug = 'studio'
)
INSERT INTO public.gallery_images (gallery_id, src, alt, position)
SELECT 
  gallery.id,
  src,
  alt,
  row_number() OVER (ORDER BY ord) as position
FROM gallery, (
  VALUES
    (1, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/225fd319-6da7-46d4-a73f-fefdaa23ef02/_C7A3526+2.jpg', ''),
    (2, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/e74d7586-4697-42f4-8d5e-2c5d437f966e/_C7A3568.jpg', ''),
    (3, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/ac51671f-5fd8-48e1-bfc9-5dfe9cb633ac/431059436_18249432889245661_4774191971648109446_n.jpg', ''),
    (4, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/5ab03dea-2051-4f1c-8399-84b65d174dc0/5af84177-a504-7df7-aa82s-209047b2bf23.jpeg', ''),
    (5, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/73250edd-405f-40ed-b6db-4e58ac7ec7f6/am.jpg', ''),
    (6, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/402ec764-68fc-4aa3-9cda-eac4c5789b3b/KFL+Smiley-+Untitled+Session59864.jpg', ''),
    (7, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/05a9eabf-7c94-413a-8694-89dbf70ad51d/6-2.jpg', ''),
    (8, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/5b52bf9e-13e9-414f-b032-77df4cda437e/Untitled+Catalog1119.jpg', ''),
    (9, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/26a7a181-5fdf-4f05-8064-5c7d38ec1810/p11B.jpg', ''),
    (10, 'https://images.squarespace-cdn.com/content/v1/61698c11d84cc850768a6bf8/daff8968-5626-4367-aa31-5b3826e82f98/L1070614.jpg', '')
) AS v(ord, src, alt)
WHERE NOT EXISTS (
  SELECT 1 FROM public.gallery_images gi
  JOIN public.galleries g ON gi.gallery_id = g.id
  WHERE g.slug = 'studio'
);