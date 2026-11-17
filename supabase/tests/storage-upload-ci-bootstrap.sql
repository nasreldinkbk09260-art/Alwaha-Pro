-- CI-only Supabase Storage fixture. No production data or network is used.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS storage.objects (
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid,
  PRIMARY KEY (bucket_id, name)
);

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text LANGUAGE sql STABLE
AS $function$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
$function$;

CREATE OR REPLACE FUNCTION storage.foldername(p_name text)
RETURNS text[] LANGUAGE sql IMMUTABLE
AS $function$
  SELECT CASE
    WHEN cardinality(parts) > 1 THEN parts[1:cardinality(parts)-1]
    ELSE ARRAY[]::text[]
  END
  FROM (SELECT string_to_array(COALESCE(p_name, ''), '/') AS parts) AS names;
$function$;

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;

INSERT INTO storage.buckets(id,name,public)
VALUES ('avatars','avatars',true),('posts','posts',true),('products','products',true),('media','media',true)
ON CONFLICT(id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated Users Upload" ON storage.objects;
CREATE POLICY "Authenticated Users Upload"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  auth.role() = 'authenticated'
  AND bucket_id = ANY (ARRAY['avatars','posts','products'])
);
CREATE POLICY media_objects_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
