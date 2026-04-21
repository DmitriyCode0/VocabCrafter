"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";

interface ReviewFeedbackFormProps {
  attemptId: string;
}

export function ReviewFeedbackForm({ attemptId }: ReviewFeedbackFormProps) {
  const { messages } = useAppI18n();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      toast.error(messages.reviewDetail.form.enterFeedback);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          content: content.trim(),
          rating: rating > 0 ? rating : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || messages.reviewDetail.form.submitFailed);
      }

      toast.success(messages.reviewDetail.form.submitted);
      setContent("");
      setRating(0);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : messages.reviewDetail.form.submitFailed,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {messages.reviewDetail.form.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{messages.reviewDetail.form.rating}</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star === rating ? 0 : star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-0.5 transition-colors"
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
            <Label htmlFor="feedback">{messages.reviewDetail.form.feedback}</Label>
            <Textarea
              id="feedback"
              placeholder={messages.reviewDetail.form.placeholder}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          <Button type="submit" disabled={saving || !content.trim()}>
            {saving
              ? messages.reviewDetail.form.submitting
              : messages.reviewDetail.form.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
