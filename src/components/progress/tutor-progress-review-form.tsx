"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TutorProgressReviewFormProps {
  studentId: string;
  studentName: string;
}

export function TutorProgressReviewForm({
  studentId,
  studentName,
}: TutorProgressReviewFormProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim()) {
      toast.error("Please enter a review or comment");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/tutor/students/${studentId}/progress/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(),
            rating: rating > 0 ? rating : null,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save progress review");
      }

      toast.success(`Saved progress review for ${studentName}`);
      setContent("");
      setRating(0);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save progress review",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leave Progress Review</CardTitle>
        <CardDescription>
          Add a coaching note, review, or comment about {studentName}&apos;s
          current progress.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Rating (optional)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star === rating ? 0 : star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-0.5 transition-colors"
                  aria-label={`Set rating to ${star}`}
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="student-progress-review">Comment</Label>
            <Textarea
              id="student-progress-review"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder="Write a concrete review of this student's current progress, strengths, blockers, or next steps..."
            />
          </div>

          <Button type="submit" disabled={isSaving || !content.trim()}>
            {isSaving ? "Saving..." : "Save Review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}