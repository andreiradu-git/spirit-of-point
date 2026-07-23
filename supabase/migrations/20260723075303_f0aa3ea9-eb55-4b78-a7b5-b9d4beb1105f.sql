
CREATE TABLE public.asset_meta (
  url text PRIMARY KEY,
  label text,
  alt text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asset_meta TO anon, authenticated;
GRANT ALL ON public.asset_meta TO service_role;
ALTER TABLE public.asset_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read asset_meta" ON public.asset_meta FOR SELECT USING (true);
CREATE POLICY "Admins can insert asset_meta" ON public.asset_meta FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update asset_meta" ON public.asset_meta FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete asset_meta" ON public.asset_meta FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_asset_meta_updated_at BEFORE UPDATE ON public.asset_meta FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
