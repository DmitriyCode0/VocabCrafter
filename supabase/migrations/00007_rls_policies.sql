-- =============================================
-- Row Level Security Policies
-- =============================================

-- ========== PROFILES ==========

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Tutors can read profiles of students in their classes
CREATE POLICY "Tutors can read student profiles in their classes"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.student_id = profiles.id
        AND c.tutor_id = auth.uid()
    )
  );

-- ========== CLASSES ==========

-- Tutors can create classes
CREATE POLICY "Tutors can create classes"
  ON public.classes FOR INSERT
  WITH CHECK (auth.uid() = tutor_id);

-- Tutors can read their own classes
CREATE POLICY "Tutors can read own classes"
  ON public.classes FOR SELECT
  USING (tutor_id = auth.uid());

-- Students can read classes they are members of
CREATE POLICY "Students can read joined classes"
  ON public.classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = classes.id AND cm.student_id = auth.uid()
    )
  );

-- Anyone can look up a class by join code (for joining)
CREATE POLICY "Anyone can read class by join code"
  ON public.classes FOR SELECT
  USING (is_active = TRUE);

-- Tutors can update their own classes
CREATE POLICY "Tutors can update own classes"
  ON public.classes FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- Tutors can delete their own classes
CREATE POLICY "Tutors can delete own classes"
  ON public.classes FOR DELETE
  USING (tutor_id = auth.uid());

-- ========== CLASS MEMBERS ==========

-- Students can join classes
CREATE POLICY "Students can join classes"
  ON public.class_members FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own memberships
CREATE POLICY "Students can read own memberships"
  ON public.class_members FOR SELECT
  USING (student_id = auth.uid());

-- Tutors can read members of their classes
CREATE POLICY "Tutors can read class members"
  ON public.class_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id AND c.tutor_id = auth.uid()
    )
  );

-- Students can leave classes
CREATE POLICY "Students can leave classes"
  ON public.class_members FOR DELETE
  USING (student_id = auth.uid());

-- Tutors can remove students from their classes
CREATE POLICY "Tutors can remove class members"
  ON public.class_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_members.class_id AND c.tutor_id = auth.uid()
    )
  );

-- ========== QUIZZES ==========

-- Users can create quizzes
CREATE POLICY "Users can create quizzes"
  ON public.quizzes FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Users can read their own quizzes
CREATE POLICY "Users can read own quizzes"
  ON public.quizzes FOR SELECT
  USING (creator_id = auth.uid());

-- Users can read public quizzes
CREATE POLICY "Users can read public quizzes"
  ON public.quizzes FOR SELECT
  USING (is_public = TRUE);

-- Students can read quizzes assigned to their classes
CREATE POLICY "Students can read assigned quizzes"
  ON public.quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.class_members cm ON cm.class_id = a.class_id
      WHERE a.quiz_id = quizzes.id AND cm.student_id = auth.uid()
    )
  );

-- Users can update their own quizzes
CREATE POLICY "Users can update own quizzes"
  ON public.quizzes FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Users can delete their own quizzes
CREATE POLICY "Users can delete own quizzes"
  ON public.quizzes FOR DELETE
  USING (creator_id = auth.uid());

-- ========== QUIZ ATTEMPTS ==========

-- Students can create attempts
CREATE POLICY "Students can create attempts"
  ON public.quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own attempts
CREATE POLICY "Students can read own attempts"
  ON public.quiz_attempts FOR SELECT
  USING (student_id = auth.uid());

-- Tutors can read attempts for quizzes they assigned
CREATE POLICY "Tutors can read attempts for assigned quizzes"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.classes c ON c.id = a.class_id
      WHERE a.quiz_id = quiz_attempts.quiz_id AND c.tutor_id = auth.uid()
    )
  );

-- ========== ASSIGNMENTS ==========

-- Tutors can create assignments
CREATE POLICY "Tutors can create assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (
    auth.uid() = tutor_id
    AND EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = assignments.class_id AND c.tutor_id = auth.uid()
    )
  );

-- Tutors can read their own assignments
CREATE POLICY "Tutors can read own assignments"
  ON public.assignments FOR SELECT
  USING (tutor_id = auth.uid());

-- Students can read assignments for their classes
CREATE POLICY "Students can read class assignments"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = assignments.class_id AND cm.student_id = auth.uid()
    )
  );

-- Tutors can update their own assignments
CREATE POLICY "Tutors can update own assignments"
  ON public.assignments FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());

-- Tutors can delete their own assignments
CREATE POLICY "Tutors can delete own assignments"
  ON public.assignments FOR DELETE
  USING (tutor_id = auth.uid());

-- ========== FEEDBACK ==========

-- Tutors can create feedback
CREATE POLICY "Tutors can create feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = tutor_id);

-- Tutors can read their own feedback
CREATE POLICY "Tutors can read own feedback"
  ON public.feedback FOR SELECT
  USING (tutor_id = auth.uid());

-- Students can read feedback on their attempts
CREATE POLICY "Students can read feedback on own attempts"
  ON public.feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = feedback.attempt_id AND qa.student_id = auth.uid()
    )
  );

-- Tutors can update their own feedback
CREATE POLICY "Tutors can update own feedback"
  ON public.feedback FOR UPDATE
  USING (tutor_id = auth.uid())
  WITH CHECK (tutor_id = auth.uid());
