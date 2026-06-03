-- Make sensitive buckets private and restrict object access.

UPDATE storage.buckets
SET public = false,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    file_size_limit = 5242880
WHERE id = 'avatars';

UPDATE storage.buckets
SET public = false,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    file_size_limit = 10485760
WHERE id = 'diplomas';

DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins can view diplomas" ON storage.objects;
CREATE POLICY "Admins can view diplomas"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND auth.email() = 'sargsyanaren218@gmail.com'
  );

DROP POLICY IF EXISTS "Users can upload their own diplomas" ON storage.objects;
CREATE POLICY "Users can upload their own diplomas"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own diplomas" ON storage.objects;
CREATE POLICY "Users can update their own diplomas"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own diplomas" ON storage.objects;
CREATE POLICY "Users can delete their own diplomas"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'diplomas'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Normalize any old public storage URLs stored in profiles or metadata.
UPDATE public.profiles
SET image_url = regexp_replace(image_url, '^https://[^/]+/storage/v1/object/public/avatars/', '')
WHERE image_url LIKE '%/storage/v1/object/public/avatars/%';

UPDATE public.profiles
SET diploma_url = regexp_replace(diploma_url, '^https://[^/]+/storage/v1/object/public/diplomas/', '')
WHERE diploma_url LIKE '%/storage/v1/object/public/diplomas/%';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{diploma_url}',
  to_jsonb(regexp_replace(raw_user_meta_data->>'diploma_url', '^https://[^/]+/storage/v1/object/public/diplomas/', '')),
  true
)
WHERE raw_user_meta_data ? 'diploma_url'
  AND raw_user_meta_data->>'diploma_url' LIKE '%/storage/v1/object/public/diplomas/%';
