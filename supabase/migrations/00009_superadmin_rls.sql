-- =============================================
-- Superadmin RLS Override Policies
-- =============================================
-- Uses a SECURITY DEFINER helper function to avoid infinite recursion
-- that occurs when checking profiles.role from within a profiles RLS policy.

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

CREATE POLICY "Superadmins can read all profiles"
  ON public.profiles FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can read all classes"
  ON public.classes FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can read all class members"
  ON public.class_members FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can read all quizzes"
  ON public.quizzes FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can read all quiz attempts"
  ON public.quiz_attempts FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can read all assignments"
  ON public.assignments FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Superadmins can read all feedback"
  ON public.feedback FOR SELECT USING (public.is_superadmin());
