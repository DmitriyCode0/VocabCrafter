import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { QuizPlayer } from "@/components/quiz/quiz-player";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !quiz) {
    notFound();
  }

  const ACTIVITY_LABELS: Record<string, string> = {
    flashcards: "Flashcards",
    gap_fill: "Fill in the Gap",
    translation: "Sentence Translation",
    mcq: "Multiple Choice",
    matching: "Matching",
    discussion: "Discussion",
    text_translation: "Text Translation",
    translation_list: "Translation List",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quizzes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            {ACTIVITY_LABELS[quiz.type] || quiz.type}
          </p>
        </div>
      </div>

      <QuizPlayer quiz={quiz as Quiz} />
    </div>
  );
}
