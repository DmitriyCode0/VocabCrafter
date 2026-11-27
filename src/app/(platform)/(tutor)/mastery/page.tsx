import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentVocabularyPageContent } from "@/components/mastery/student-vocabulary-page-content";

export const dynamic = "force-dynamic";

interface TutorMasteryPageProps {
  searchParams: Promise<{ page?: string; student?: string }>;
}

export default async function TutorMasteryPage({
  searchParams,
}: TutorMasteryPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "student") {
    return StudentVocabularyPageContent({ searchParams });
  }

  if (profile?.role === "superadmin") {
    redirect("/vocabulary");
  }

  const { student } = await searchParams;
  if (student) {
    redirect(`/results?tab=vocabulary&student=${encodeURIComponent(student)}`);
  }

  redirect("/results?tab=students");
}
