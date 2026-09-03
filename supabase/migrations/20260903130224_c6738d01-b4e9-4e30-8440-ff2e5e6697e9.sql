DROP POLICY IF EXISTS "anyone can log pageview" ON public.page_views;
REVOKE INSERT ON public.page_views FROM anon, authenticated;
CREATE POLICY "service role writes pageviews" ON public.page_views FOR INSERT TO service_role WITH CHECK (true);
GRANT INSERT ON public.page_views TO service_role;