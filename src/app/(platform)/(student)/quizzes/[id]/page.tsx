import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen } from "lucide-react";

export default async function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quiz</h1>
        <p className="text-muted-foreground">Quiz ID: {id}</p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            The quiz player is being built. You will be able to practice
            flashcards, fill-in-the-gap, and translation activities here.
          </CardDescription>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/quizzes">Back to Quizzes</Link>
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
