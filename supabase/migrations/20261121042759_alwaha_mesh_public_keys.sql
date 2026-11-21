BEGIN;

-- Public endpoint keys for account-to-account end-to-end encryption.
-- Relay-only bridge keys are ephemeral and are never stored in this table.
CREATE TABLE public.alwaha_mesh_public_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_version smallint NOT NULL DEFAULT 1 CHECK (protocol_version = 1),
  ecdh_public_key text NOT NULL CHECK (ecdh_public_key ~ '^[A-Za-z0-9_-]{87}$'),
  signing_public_key text NOT NULL CHECK (signing_public_key ~ '^[A-Za-z0-9_-]{87}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.alwaha_mesh_public_keys IS
  'Public E2E account endpoint keys only. Never store relay bridge identities or private keys here.';
COMMENT ON COLUMN public.alwaha_mesh_public_keys.ecdh_public_key IS
  'Raw uncompressed P-256 ECDH public key encoded as unpadded base64url.';
COMMENT ON COLUMN public.alwaha_mesh_public_keys.signing_public_key IS
  'Raw uncompressed P-256 ECDSA public key encoded as unpadded base64url.';

ALTER TABLE public.alwaha_mesh_public_keys ENABLE ROW LEVEL SECURITY;

-- Public-schema tables are not automatically exposed to the Data API on new
-- Supabase defaults. Explicit grants are required in addition to RLS.
REVOKE ALL ON TABLE public.alwaha_mesh_public_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.alwaha_mesh_public_keys TO authenticated;
GRANT UPDATE (user_id, protocol_version, ecdh_public_key, signing_public_key, updated_at)
  ON TABLE public.alwaha_mesh_public_keys TO authenticated;

CREATE POLICY alwaha_mesh_public_keys_select_authenticated
  ON public.alwaha_mesh_public_keys
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY alwaha_mesh_public_keys_insert_own
  ON public.alwaha_mesh_public_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY alwaha_mesh_public_keys_update_own
  ON public.alwaha_mesh_public_keys
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
