-- 1. Add columns as nullable first so existing users can be backfilled to 'approved'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS registration_note text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- 2. Backfill ALL existing profiles as 'approved' so no current user is locked out
UPDATE public.profiles
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, created_at)
WHERE approval_status IS NULL;

UPDATE public.profiles
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, created_at)
WHERE role = 'superadmin' AND approval_status <> 'approved';

-- 3. Set NOT NULL and DEFAULT 'pending' for future signups
ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET DEFAULT 'pending',
  ALTER COLUMN approval_status SET NOT NULL;

-- 4. Add check constraint and foreign key idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_approval_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_approved_by_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_approved_by_fkey
      FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Indexes for FK and pending queue lookups
CREATE INDEX IF NOT EXISTS profiles_approved_by_idx
  ON public.profiles (approved_by);

CREATE INDEX IF NOT EXISTS profiles_approval_status_created_idx
  ON public.profiles (approval_status, created_at DESC);

-- 6. Helper function to check whether current authenticated caller is approved
CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND (approval_status = 'approved' OR role = 'superadmin')
  );
$$;

-- 7. Update signup trigger so new users start as 'pending' and store safe metadata hints
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested_role text;
BEGIN
  v_requested_role := CASE
    WHEN (NEW.raw_user_meta_data ->> 'requested_role') IN ('student', 'tutor')
      THEN NEW.raw_user_meta_data ->> 'requested_role'
    ELSE 'student'
  END;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    approval_status,
    registration_note
  )
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')), ''),
    NEW.raw_user_meta_data ->> 'avatar_url',
    v_requested_role,
    'pending',
    LEFT(NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'registration_note'), ''), 500)
  );
  RETURN NEW;
END;
$$;

-- 8. Protect privileged profile columns from client-side self-escalation
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '');
BEGIN
  IF v_jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
     OR public.is_superadmin() THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Cannot modify approval_status directly';
  END IF;

  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Cannot modify approved_at directly';
  END IF;

  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    RAISE EXCEPTION 'Cannot modify approved_by directly';
  END IF;

  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Cannot modify plan directly';
  END IF;

  IF NEW.role = 'superadmin' AND OLD.role <> 'superadmin' THEN
    RAISE EXCEPTION 'Cannot escalate role to superadmin';
  END IF;

  IF OLD.onboarding_completed = TRUE AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Cannot change role after onboarding';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER protect_profiles_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- 9. Restrictive INSERT policies without DROP statements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quizzes'
      AND policyname = 'Approved users only insert quizzes'
  ) THEN
    CREATE POLICY "Approved users only insert quizzes"
      ON public.quizzes AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_approved_user()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'classes'
      AND policyname = 'Approved users only insert classes'
  ) THEN
    CREATE POLICY "Approved users only insert classes"
      ON public.classes AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_approved_user()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'class_members'
      AND policyname = 'Approved users only insert class_members'
  ) THEN
    CREATE POLICY "Approved users only insert class_members"
      ON public.class_members AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_approved_user()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'quiz_attempts'
      AND policyname = 'Approved users only insert quiz_attempts'
  ) THEN
    CREATE POLICY "Approved users only insert quiz_attempts"
      ON public.quiz_attempts AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_approved_user()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'word_banks'
      AND policyname = 'Approved users only insert word_banks'
  ) THEN
    CREATE POLICY "Approved users only insert word_banks"
      ON public.word_banks AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK ((SELECT public.is_approved_user()));
  END IF;
END $$;
