-- Tutor-Student direct connections (independent of classes)
CREATE TABLE public.tutor_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connect_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_at TIMESTAMPTZ,
  UNIQUE(tutor_id, student_id)
);

CREATE INDEX idx_tutor_students_tutor ON public.tutor_students(tutor_id);
CREATE INDEX idx_tutor_students_student ON public.tutor_students(student_id);
CREATE INDEX idx_tutor_students_code ON public.tutor_students(connect_code);

ALTER TABLE public.tutor_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutors can create connections"
  ON public.tutor_students FOR INSERT
  WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "Tutors can view own connections"
  ON public.tutor_students FOR SELECT
  USING (auth.uid() = tutor_id);

CREATE POLICY "Students can view own connections"
  ON public.tutor_students FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can activate connections"
  ON public.tutor_students FOR UPDATE
  USING (auth.uid() = student_id AND status = 'pending');

CREATE POLICY "Tutors can delete connections"
  ON public.tutor_students FOR DELETE
  USING (auth.uid() = tutor_id);

CREATE POLICY "Students can delete connections"
  ON public.tutor_students FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "Superadmins can view all connections"
  ON public.tutor_students FOR SELECT
  USING (public.is_superadmin());

-- Tutors can read quiz_attempts from connected students
CREATE POLICY "Tutors can view connected student attempts"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_students ts
      WHERE ts.tutor_id = auth.uid()
        AND ts.student_id = quiz_attempts.student_id
        AND ts.status = 'active'
    )
  );

-- Tutors can read quizzes created by connected students
CREATE POLICY "Tutors can view connected student quizzes"
  ON public.quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_students ts
      WHERE ts.tutor_id = auth.uid()
        AND ts.student_id = quizzes.creator_id
        AND ts.status = 'active'
    )
  );

-- Tutors can read profiles of connected students
CREATE POLICY "Tutors can read connected student profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_students ts
      WHERE ts.tutor_id = auth.uid()
        AND ts.student_id = profiles.id
        AND ts.status = 'active'
    )
  );
