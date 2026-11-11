ALTER TABLE public.tutor_students
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tutor_students_active_tutor
  ON public.tutor_students(tutor_id)
  WHERE status = 'active' AND archived_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tutor_students' AND policyname = 'Tutors can update own connections'
  ) THEN
    CREATE POLICY "Tutors can update own connections"
      ON public.tutor_students FOR UPDATE
      USING (auth.uid() = tutor_id)
      WITH CHECK (auth.uid() = tutor_id);
  END IF;
END $$;

