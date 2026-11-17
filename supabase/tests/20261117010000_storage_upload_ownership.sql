BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);

INSERT INTO storage.objects(bucket_id,name,owner) VALUES
  ('avatars','11111111-1111-4111-8111-111111111111/profile/avatar.jpg','11111111-1111-4111-8111-111111111111'),
  ('posts','11111111-1111-4111-8111-111111111111/posts/post.jpg','11111111-1111-4111-8111-111111111111'),
  ('products','11111111-1111-4111-8111-111111111111/products/item.jpg','11111111-1111-4111-8111-111111111111'),
  ('media','11111111-1111-4111-8111-111111111111/reels/video.mp4','11111111-1111-4111-8111-111111111111');

DO $test$
DECLARE denied boolean;
BEGIN
  denied := false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner)
    VALUES ('avatars','22222222-2222-4222-8222-222222222222/profile/other.jpg','11111111-1111-4111-8111-111111111111');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-user avatar folder upload was allowed'; END IF;

  denied := false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner)
    VALUES ('posts','22222222-2222-4222-8222-222222222222/posts/other.jpg','11111111-1111-4111-8111-111111111111');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-user post folder upload was allowed'; END IF;

  denied := false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner)
    VALUES ('products','22222222-2222-4222-8222-222222222222/products/other.jpg','11111111-1111-4111-8111-111111111111');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-user product folder upload was allowed'; END IF;

  denied := false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner)
    VALUES ('media','22222222-2222-4222-8222-222222222222/reels/other.mp4','11111111-1111-4111-8111-111111111111');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-user media folder upload was allowed'; END IF;
END
$test$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role','anon',true);
SELECT set_config('request.jwt.claim.sub','',true);
DO $anonymous$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner)
    VALUES ('avatars','11111111-1111-4111-8111-111111111111/profile/anon.jpg',NULL);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Anonymous upload was allowed'; END IF;
END
$anonymous$;

RESET ROLE;
DO $policies$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated Users Upload'
  ) THEN
    RAISE EXCEPTION 'Legacy catch-all storage upload policy remains installed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='authenticated_users_upload_own_folder'
      AND cmd='INSERT'
  ) THEN
    RAISE EXCEPTION 'Scoped storage upload policy is missing';
  END IF;
END
$policies$;
COMMIT;
SELECT 'STORAGE_UPLOAD_OWNERSHIP=PASS';
