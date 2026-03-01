import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import { QuizHeader } from "@/components/quiz/quiz-header";
import type { Quiz } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Use admin client so students can access assigned quizzes (bypasses RLS)
  const supabaseAdmin = createAdminClient();
  const { data: quiz, error } = await supabaseAdmin
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !quiz) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <QuizHeader
        quizId={quiz.id}
        title={quiz.title}
        type={quiz.type}
        isOwner={quiz.creator_id === user.id}
      />

      <QuizPlayer quiz={quiz as Quiz} />
    </div>
  );
}
