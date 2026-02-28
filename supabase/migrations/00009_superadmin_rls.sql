-- =============================================
-- Superadmin RLS Override Policies
-- =============================================
-- Superadmins need to read all data for analytics, user management, and billing.
-- These policies allow superadmin users (role = 'superadmin' in profiles) to SELECT from all tables.

-- ========== PROFILES ==========
CREATE POLICY "Superadmins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'superadmin'
    )
  );

-- ========== CLASSES ==========
CREATE POLICY "Superadmins can read all classes"
  ON public.classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ========== CLASS MEMBERS ==========
CREATE POLICY "Superadmins can read all class members"
  ON public.class_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ========== QUIZZES ==========
CREATE POLICY "Superadmins can read all quizzes"
  ON public.quizzes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ========== QUIZ ATTEMPTS ==========
CREATE POLICY "Superadmins can read all quiz attempts"
  ON public.quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ========== ASSIGNMENTS ==========
CREATE POLICY "Superadmins can read all assignments"
  ON public.assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );

-- ========== FEEDBACK ==========
CREATE POLICY "Superadmins can read all feedback"
  ON public.feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'superadmin'
    )
  );
