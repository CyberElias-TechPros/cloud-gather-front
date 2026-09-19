-- ═══════════════════════════════════════════════════════════════════════════
-- CloudGather — consolidated productionization migration (2026-09-07)
--
-- Idempotent. Safe to run via `supabase db push` on an existing project.
-- Sections:
--   1. Profiles: settings column, missing rows, signup trigger
--   2. updated_at triggers for all mutable tables
--   3. api_keys: reconcile legacy plaintext-key schema to hashed keys
--   4. RLS: admin policies, tightened audit-log / admin_users policies
--   5. Integrity: unique file names per folder (duplicates are reported)
--   6. Indexes for the app's hot query paths
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Profiles ────────────────────────────────────────────────────────────

-- Per-user preferences document (theme, default view, notification toggles).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Profile creation on signup. Replaces the older trigger body so the display
-- name prefers the user-chosen name from signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profile rows for users that predate the trigger.
INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data ->> 'name', u.email)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- ── 2. updated_at triggers ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY['profiles', 'files', 'storage_providers', 'file_shares', 'teams', 'team_members']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', target);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', target);
  END LOOP;
END $$;

-- ── 3. api_keys reconciliation ────────────────────────────────────────────
-- Older revisions of this table stored plaintext keys in a `key` column with a
-- `status` column; the current scheme stores a SHA-256 hash (key_hash) plus a
-- display prefix (key_prefix). Reconcile without destroying existing keys.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key_hash') THEN
      ALTER TABLE public.api_keys ADD COLUMN key_hash TEXT;
      ALTER TABLE public.api_keys ADD COLUMN key_prefix VARCHAR(10);
    END IF;
    -- Hash any plaintext keys so they keep working, then remove plaintext.
    UPDATE public.api_keys
    SET key_hash = encode(sha256(key::bytea), 'hex'),
        key_prefix = left(key, 8)
    WHERE key_hash IS NULL AND key IS NOT NULL;
    ALTER TABLE public.api_keys ALTER COLUMN key_hash SET NOT NULL;
    ALTER TABLE public.api_keys DROP COLUMN IF EXISTS key;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'key_prefix') THEN
    ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_prefix VARCHAR(10) NOT NULL DEFAULT left(key_hash, 8);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'permissions') THEN
    ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '["read"]'::jsonb;
  END IF;
END $$;

-- Drop the legacy status column (revocation is now a hard delete).
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS status;

-- ── 4. Row-level security fixes ───────────────────────────────────────────

-- 4a. Admin users list: only admins themselves may see it (was: any
--     authenticated user could enumerate admin identities).
DROP POLICY IF EXISTS "Authenticated users can view admin users" ON public.admin_users;
CREATE POLICY "Admins can view admin users"
  ON public.admin_users
  FOR SELECT
  USING (public.is_admin_user());

-- 4b. Audit log writes: only your own rows from the client (was: WITH CHECK
--     (true), which let anyone write forged log entries).
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert their own audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4c. Admin read access for the console (counts + user management).
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can read all files" ON public.files;
CREATE POLICY "Admins can read all files"
  ON public.files
  FOR SELECT
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can read all storage providers" ON public.storage_providers;
CREATE POLICY "Admins can read all storage providers"
  ON public.storage_providers
  FOR SELECT
  USING (public.is_admin_user());

-- 4d. Ensure admin helper functions exist with a safe search_path.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE email = auth.email()
  );
$$;

-- ── 5. File naming integrity ──────────────────────────────────────────────
-- One file name per folder per user. Existing duplicates (if any) are reported
-- as notices instead of failing the migration; run the cleanup query printed
-- below, then re-run this migration to install the index.

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT user_id, COALESCE(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid) AS folder, filename
    FROM public.files
    GROUP BY user_id, COALESCE(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid), filename
    HAVING COUNT(*) > 1
  ) d;

  IF duplicate_count > 0 THEN
    RAISE NOTICE
      'files: % duplicate (user, folder, name) groups found. Resolve with: %',
      duplicate_count,
      'DELETE FROM files a USING files b WHERE a.id > b.id AND a.user_id = b.user_id AND a.filename = b.filename AND COALESCE(a.parent_folder_id::text, '''') = COALESCE(b.parent_folder_id::text, '''');';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS files_unique_name_per_folder
      ON public.files (user_id, COALESCE(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid), filename);
  END IF;
END $$;

-- ── 6. Query-path indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_files_user_updated ON public.files (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_user_starred ON public.files (user_id) WHERE is_starred;
CREATE INDEX IF NOT EXISTS idx_files_user_shared ON public.files (user_id) WHERE is_shared;
CREATE INDEX IF NOT EXISTS idx_files_path_pattern ON public.files (user_id, path text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_file_shares_owner ON public.file_shares (owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storage_providers_user_status ON public.storage_providers (user_id, status);
