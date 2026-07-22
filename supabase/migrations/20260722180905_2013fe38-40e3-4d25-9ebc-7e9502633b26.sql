INSERT INTO public.galleries (slug, title, tagline)
VALUES
  ('food', 'Food', 'Food photography portfolio'),
  ('people', 'People', 'People photography portfolio'),
  ('editorial', 'Editorial', 'Editorial photography portfolio'),
  ('patterns', 'Patterns', 'Patterns photography portfolio')
ON CONFLICT (slug) DO NOTHING;