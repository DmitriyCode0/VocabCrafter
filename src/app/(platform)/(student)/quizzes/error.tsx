"use client";

import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function QuizzesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="items-center text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive/50 mb-2" />
          <CardTitle className="text-lg">Failed to load quizzes</CardTitle>
          <CardDescription>
            {error.message || "Something went wrong. Please try again."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pb-12">
          <Button onClick={reset} className="w-full max-w-xs">
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
