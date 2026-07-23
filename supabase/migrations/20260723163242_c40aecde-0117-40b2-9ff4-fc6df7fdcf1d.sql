-- 1) Remove broad public SELECT policy on storage.objects for media bucket.
-- Public bucket URLs still serve files; this only blocks anonymous .list() calls.
DROP POLICY IF EXISTS "public read media" ON storage.objects;

-- 2) Replace unrestricted page_views INSERT policy with validated one.
DROP POLICY IF EXISTS "anyone can log pageview" ON public.page_views;

CREATE POLICY "anyone can log pageview"
  ON public.page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(path) BETWEEN 1 AND 500
    AND (referrer IS NULL OR length(referrer) <= 1000)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
    AND (session_id IS NULL OR length(session_id) <= 100)
    AND (search_query IS NULL OR length(search_query) <= 500)
    AND (city IS NULL OR length(city) <= 100)
    AND (country IS NULL OR length(country) <= 100)
  );