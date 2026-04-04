CREATE TABLE public.tutor_student_progress_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  axis_overrides JSONB NOT NULL DEFAULT '[]'::jsonb,
  insights_override JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tutor_id, student_id),
  CONSTRAINT tutor_student_progress_overrides_axis_overrides_is_array CHECK (
    jsonb_typeof(axis_overrides) = 'array'
  ),
  CONSTRAINT tutor_student_progress_overrides_insights_override_is_object CHECK (
    insights_override IS NULL OR jsonb_typeof(insights_override) = 'object'
  )
);

CREATE INDEX idx_tutor_student_progress_overrides_tutor
  ON public.tutor_student_progress_overrides(tutor_id);

CREATE INDEX idx_tutor_student_progress_overrides_student
  ON public.tutor_student_progress_overrides(student_id);

ALTER TABLE public.tutor_student_progress_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can view own student progress overrides"
  ON public.tutor_student_progress_overrides FOR SELECT
  USING (auth.uid() = tutor_id);

CREATE POLICY "Tutors can create own student progress overrides"
  ON public.tutor_student_progress_overrides FOR INSERT
  WITH CHECK (
    auth.uid() = tutor_id
    AND EXISTS (
      SELECT 1 FROM public.tutor_students ts
      WHERE ts.tutor_id = auth.uid()
        AND ts.student_id = tutor_student_progress_overrides.student_id
        AND ts.status = 'active'
    )
  );

CREATE POLICY "Tutors can update own student progress overrides"
  ON public.tutor_student_progress_overrides FOR UPDATE
  USING (auth.uid() = tutor_id)
  WITH CHECK (
    auth.uid() = tutor_id
    AND EXISTS (
      SELECT 1 FROM public.tutor_students ts
      WHERE ts.tutor_id = auth.uid()
        AND ts.student_id = tutor_student_progress_overrides.student_id
        AND ts.status = 'active'
    )
  );

CREATE POLICY "Tutors can delete own student progress overrides"
  ON public.tutor_student_progress_overrides FOR DELETE
  USING (auth.uid() = tutor_id);

CREATE POLICY "Superadmins can view all student progress overrides"
  ON public.tutor_student_progress_overrides FOR SELECT
  USING (public.is_superadmin());