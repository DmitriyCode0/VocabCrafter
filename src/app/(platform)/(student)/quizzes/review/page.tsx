"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle2, BookOpen } from "lucide-react";
import Link from "next/link";

export default function ReviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);

  const handleStartReview = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/review-activity", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === "NO_WORDS_TO_REVIEW") {
          setError(
            "No words to review yet. Keep practicing quizzes to build your vocabulary library!",
          );
        } else if (data.code === "QUOTA_EXCEEDED") {
          setError(data.error);
        } else {
          setError(data.error || "Failed to generate review activity");
        }
        return;
      }

      const { quiz } = await response.json();
      setQuizId(quiz.id);
      setSuccess(true);

      // Redirect to quiz after a short delay
      setTimeout(() => {
        router.push(`/quizzes/${quiz.id}`);
      }, 1500);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Review Activity Generated!</CardTitle>
            <CardDescription>
              Starting your personalized review exercise...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Redirecting to quiz...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review Activity</h1>
        <p className="text-muted-foreground">
          Practice your least known words with personalized gap-fill exercises.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <p className="font-medium">5 Least Known Words</p>
                <p className="text-sm text-muted-foreground">
                  We'll select your 5 least practiced words from your vocabulary
                  library.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <p className="font-medium">Gap Fill Exercises</p>
                <p className="text-sm text-muted-foreground">
                  Complete sentences by filling in the blanks using the target
                  words.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <p className="font-medium">Track Progress</p>
                <p className="text-sm text-muted-foreground">
                  Your performance updates your mastery level for each word.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleStartReview}
          disabled={loading}
          size="lg"
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Start Review"
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/quizzes">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}
