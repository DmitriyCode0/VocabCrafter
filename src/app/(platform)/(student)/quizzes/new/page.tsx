import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default function NewQuizPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create New Quiz</h1>
        <p className="text-muted-foreground">
          Paste your vocabulary words and generate AI-powered activities.
        </p>
      </div>

      <Card>
        <CardHeader className="items-center text-center py-12">
          <PlusCircle className="h-12 w-12 text-muted-foreground/50 mb-2" />
          <CardTitle className="text-lg">Coming Soon</CardTitle>
          <CardDescription>
            The word parser and quiz creation flow is being built. You will be
            able to paste text, extract vocabulary, and generate flashcards,
            fill-in-the-gap, and translation activities.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
