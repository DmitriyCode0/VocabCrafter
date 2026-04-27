ALTER TABLE public.tutor_student_progress_overrides
ADD COLUMN IF NOT EXISTS monthly_target_overrides JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tutor_student_progress_overrides_monthly_target_overrides_is_object'
  ) THEN
    ALTER TABLE public.tutor_student_progress_overrides
    ADD CONSTRAINT tutor_student_progress_overrides_monthly_target_overrides_is_object
    CHECK (
      monthly_target_overrides IS NULL
      OR jsonb_typeof(monthly_target_overrides) = 'object'
    );
  END IF;
END $$;

COMMENT ON COLUMN public.tutor_student_progress_overrides.monthly_target_overrides IS
'Tutor-set per-student monthly pentagram targets for transcript, practice, passive, active days, activity, and grammar goals.';