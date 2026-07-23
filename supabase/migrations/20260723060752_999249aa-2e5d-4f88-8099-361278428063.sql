
-- SEO overrides per page path
CREATE TABLE public.page_seo (
  path TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  keywords TEXT,
  og_image TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.page_seo TO anon, authenticated;
GRANT ALL ON public.page_seo TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.page_seo TO authenticated;
ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read page_seo" ON public.page_seo FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write page_seo" ON public.page_seo FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Analytics pageview log
CREATE TABLE public.page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  session_id TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX page_views_path_idx ON public.page_views (path);
GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can log pageview" ON public.page_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admins read page_views" ON public.page_views FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
