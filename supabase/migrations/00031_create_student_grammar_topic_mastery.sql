-- Tracks grammar topics that a student has mastered.
-- source = 'system' means auto-computed (5+ sentence translation quizzes at 90%+).
-- source = 'tutor' means manually marked by a tutor.

CREATE TABLE public.student_grammar_topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_key TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('system', 'tutor')),
  tutor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, topic_key)
);

CREATE INDEX idx_grammar_topic_mastery_student ON public.student_grammar_topic_mastery (student_id);

ALTER TABLE public.student_grammar_topic_mastery ENABLE ROW LEVEL SECURITY;

-- Students can read their own mastery records
CREATE POLICY "Students can view own grammar topic mastery"
  ON public.student_grammar_topic_mastery
  FOR SELECT
  USING (auth.uid() = student_id);

-- Tutors can read mastery for their students
CREATE POLICY "Tutors can view student grammar topic mastery"
  ON public.student_grammar_topic_mastery
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('tutor', 'superadmin')
    )
  );

-- Tutors can insert tutor-sourced mastery records
CREATE POLICY "Tutors can insert grammar topic mastery"
  ON public.student_grammar_topic_mastery
  FOR INSERT
  WITH CHECK (
    source = 'tutor'
    AND tutor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('tutor', 'superadmin')
    )
  );

-- Tutors can delete their own tutor-sourced records
CREATE POLICY "Tutors can delete own grammar topic mastery"
  ON public.student_grammar_topic_mastery
  FOR DELETE
  USING (
    source = 'tutor'
    AND tutor_id = auth.uid()
  );

-- Superadmins can do everything
CREATE POLICY "Superadmins full access to grammar topic mastery"
  ON public.student_grammar_topic_mastery
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
