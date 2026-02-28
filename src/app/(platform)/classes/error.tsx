"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ClassesError({
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
          <CardTitle className="text-lg">Failed to load classes</CardTitle>
          <CardDescription>
            {error.message || "Something went wrong. Please try again."}
          </CardDescription>
          <Button onClick={reset} className="mt-4">
            Try Again
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
