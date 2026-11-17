BEGIN;
-- The legacy catch-all policy let any authenticated user upload into another
-- user's public avatar/post/product folders. Preserve public reads, but bind
-- each new upload in these legacy buckets to the uploader's own UID folder.
DROP POLICY IF EXISTS "Authenticated Users Upload" ON storage.objects;
DROP POLICY IF EXISTS authenticated_users_upload_own_folder ON storage.objects;
CREATE POLICY authenticated_users_upload_own_folder
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('avatars', 'posts', 'products')
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
COMMIT;
