import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { BookOpen, PlusCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  flashcards: "Flashcards",
  gap_fill: "Fill in the Gap",
  translation: "Translation",
  mcq: "Multiple Choice",
  matching: "Matching",
  discussion: "Discussion",
  text_translation: "Text Translation",
  translation_list: "Translation List",
};

export default async function QuizzesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("*")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Quizzes</h1>
          <p className="text-muted-foreground">
            View and manage your vocabulary quizzes.
          </p>
        </div>
        <Button asChild>
          <Link href="/quizzes/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New Quiz
          </Link>
        </Button>
      </div>

      {!quizzes || quizzes.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No quizzes yet</CardTitle>
            <CardDescription>
              Create your first quiz by pasting vocabulary words and letting AI
              generate activities for you.
            </CardDescription>
            <Button asChild className="mt-4">
              <Link href="/quizzes/new">Create Your First Quiz</Link>
            </Button>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const terms = quiz.vocabulary_terms as { term: string; definition: string }[];
            return (
              <Link key={quiz.id} href={`/quizzes/${quiz.id}`}>
                <Card className="h-full transition-colors hover:border-primary cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{quiz.title}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {ACTIVITY_LABELS[quiz.type] || quiz.type}
                      </Badge>
                    </div>
                    <CardDescription>
                      {Array.isArray(terms) ? terms.length : 0} terms &middot; CEFR{" "}
                      {quiz.cefr_level}
                    </CardDescription>
                    <p className="text-xs text-muted-foreground">
                      {new Date(quiz.created_at).toLocaleDateString()}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
