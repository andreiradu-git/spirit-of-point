-- No client-side listing is needed for the public media bucket.
-- Files are served directly via public URL; uploads/deletes are handled
-- by admin-only INSERT/UPDATE/DELETE policies.
DROP POLICY IF EXISTS "Public read media" ON storage.objects;
DROP POLICY IF EXISTS "Owner read media" ON storage.objects;