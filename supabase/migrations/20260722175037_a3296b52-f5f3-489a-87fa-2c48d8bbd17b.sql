-- Public read access to the media bucket
CREATE POLICY "Public read media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media');

-- Admin upload to media bucket
CREATE POLICY "Admin upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Admin update own uploads in media bucket
CREATE POLICY "Admin update media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id = 'media'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Admin delete from media bucket
CREATE POLICY "Admin delete media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND public.has_role(auth.uid(), 'admin')
  );