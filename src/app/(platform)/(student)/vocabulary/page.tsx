import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  Star,
  Clock,
  TrendingUp,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

const LEVEL_LABELS = [
  "New",
  "Seen",
  "Learning",
  "Familiar",
  "Practiced",
  "Mastered",
] as const;

const LEVEL_COLORS = [
  "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
] as const;

interface WordMasteryRow {
  id: string;
  term: string;
  definition: string | null;
  mastery_level: number;
  correct_count: number;
  incorrect_count: number;
  streak: number;
  last_practiced: string | null;
  next_review: string | null;
}

export default async function VocabularyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const supabaseAdmin = createAdminClient();

  const { data: words } = await supabaseAdmin
    .from("word_mastery")
    .select("*")
    .eq("student_id", user.id)
    .order("mastery_level", { ascending: true })
    .order("last_practiced", { ascending: false });

  const allWords = (words ?? []) as WordMasteryRow[];

  // Stats
  const totalWords = allWords.length;
  const masteredCount = allWords.filter((w) => w.mastery_level >= 5).length;
  const dueForReview = allWords.filter(
    (w) => w.next_review && new Date(w.next_review) <= new Date(),
  ).length;
  const avgLevel =
    totalWords > 0
      ? (
          allWords.reduce((sum, w) => sum + w.mastery_level, 0) / totalWords
        ).toFixed(1)
      : "0";

  // Group by level
  const wordsByLevel = new Map<number, WordMasteryRow[]>();
  for (const w of allWords) {
    const level = w.mastery_level;
    if (!wordsByLevel.has(level)) wordsByLevel.set(level, []);
    wordsByLevel.get(level)!.push(w);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Vocabulary</h1>
        <p className="text-muted-foreground">
          Track your word mastery with spaced-repetition levels.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Words</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWords}</div>
            <p className="text-xs text-muted-foreground">tracked vocabulary</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mastered</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {masteredCount}
            </div>
            <Progress
              value={totalWords > 0 ? (masteredCount / totalWords) * 100 : 0}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due for Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dueForReview}
            </div>
            <p className="text-xs text-muted-foreground">
              words to practice
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Level</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLevel}</div>
            <p className="text-xs text-muted-foreground">out of 5</p>
          </CardContent>
        </Card>
      </div>

      {/* Level legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mastery Levels</CardTitle>
          <CardDescription>
            Words progress through 6 levels as you practice them correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {LEVEL_LABELS.map((label, i) => {
              const count = wordsByLevel.get(i)?.length ?? 0;
              return (
                <Badge
                  key={i}
                  variant="outline"
                  className={`${LEVEL_COLORS[i]} border-0 px-3 py-1`}
                >
                  {i}: {label} ({count})
                </Badge>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {totalWords === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No vocabulary tracked yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Complete quizzes to start building your word mastery profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Words grouped by level (ascending— weakest first) */
        Array.from(wordsByLevel.entries())
          .sort(([a], [b]) => a - b)
          .map(([level, levelWords]) => (
            <Card key={level}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`${LEVEL_COLORS[level]} border-0`}
                    >
                      Level {level}
                    </Badge>
                    {LEVEL_LABELS[level]}
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {levelWords.length} word
                    {levelWords.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {levelWords.map((w) => {
                    const total = w.correct_count + w.incorrect_count;
                    const accuracy =
                      total > 0
                        ? Math.round((w.correct_count / total) * 100)
                        : 0;
                    const isDue =
                      w.next_review && new Date(w.next_review) <= new Date();

                    return (
                      <div
                        key={w.id}
                        className="flex flex-col gap-1 rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{w.term}</span>
                          <div className="flex items-center gap-1.5">
                            {w.streak > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5"
                              >
                                🔥 {w.streak}
                              </Badge>
                            )}
                            {isDue && (
                              <Badge
                                variant="destructive"
                                className="text-xs px-1.5"
                              >
                                Due
                              </Badge>
                            )}
                          </div>
                        </div>
                        {w.definition && (
                          <p className="text-xs text-muted-foreground truncate">
                            {w.definition}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                          <span>
                            {w.correct_count}✓ {w.incorrect_count}✗ ({accuracy}
                            %)
                          </span>
                          {w.last_practiced && (
                            <span>
                              {new Date(
                                w.last_practiced,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
      )}
    </div>
  );
}
