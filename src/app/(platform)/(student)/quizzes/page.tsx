import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, PlusCircle } from "lucide-react";

export default function QuizzesPage() {
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
    </div>
  );
}
