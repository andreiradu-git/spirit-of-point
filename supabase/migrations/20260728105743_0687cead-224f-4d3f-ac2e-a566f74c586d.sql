CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_provider text NOT NULL DEFAULT 'r2',
  bucket text NOT NULL DEFAULT 'pointstudio-assets',
  object_key text NOT NULL,
  filename text NOT NULL,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  content_type text,
  size bigint,
  optimized_object_key text,
  optimized_url text,
  original_object_key text,
  original_url text,
  label text,
  alt text,
  caption text,
  description text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  used_on_site boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_storage_provider_check CHECK (storage_provider IN ('r2')),
  CONSTRAINT media_assets_kind_check CHECK (kind IN ('image', 'video', 'file', 'link')),
  CONSTRAINT media_assets_object_key_unique UNIQUE (object_key),
  CONSTRAINT media_assets_url_unique UNIQUE (url)
);

GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'media_assets' AND policyname = 'public read media assets'
  ) THEN
    CREATE POLICY "public read media assets" ON public.media_assets FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'media_assets' AND policyname = 'admins insert media assets'
  ) THEN
    CREATE POLICY "admins insert media assets" ON public.media_assets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'media_assets' AND policyname = 'admins update media assets'
  ) THEN
    CREATE POLICY "admins update media assets" ON public.media_assets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'media_assets' AND policyname = 'admins delete media assets'
  ) THEN
    CREATE POLICY "admins delete media assets" ON public.media_assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_media_assets_updated_at ON public.media_assets;
CREATE TRIGGER trg_media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gallery_images ADD COLUMN IF NOT EXISTS media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_images_media_asset_id ON public.gallery_images(media_asset_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_kind ON public.media_assets(kind);
CREATE INDEX IF NOT EXISTS idx_media_assets_used_on_site ON public.media_assets(used_on_site);
