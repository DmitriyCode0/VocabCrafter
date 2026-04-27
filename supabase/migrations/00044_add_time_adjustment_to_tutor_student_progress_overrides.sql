ALTER TABLE public.tutor_student_progress_overrides
ADD COLUMN IF NOT EXISTS time_adjustment_hours NUMERIC(8,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tutor_student_progress_overrides.time_adjustment_hours IS
'Tutor-set additive adjustment applied to a student\'s tracked total learning time.';