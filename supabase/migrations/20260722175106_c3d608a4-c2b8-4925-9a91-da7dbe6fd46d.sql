-- Remove the broad listing policy; public bucket files are still served by URL.
DROP POLICY IF EXISTS "Public read media" ON storage.objects;

-- Allow authenticated users to read only objects they own (uploaded by them).
-- This avoids the "public bucket allows listing" linter warning while still
-- permitting the owner to verify/delete their own uploads.
CREATE POLICY "Owner read media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND owner = auth.uid());