ALTER TABLE public.tutor_students
  ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX idx_tutor_students_active_tutor
  ON public.tutor_students(tutor_id)
  WHERE status = 'active' AND archived_at IS NULL;
