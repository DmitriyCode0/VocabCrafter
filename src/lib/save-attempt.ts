import { toast } from "sonner";

export async function saveAttempt(
  quizId: string,
  answers: Record<string, unknown>,
  score: number | null,
  maxScore: number | null,
  timeSpentSeconds?: number,
) {
  try {
    const response = await fetch("/api/quiz-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizId,
        answers,
        score,
        maxScore,
        timeSpentSeconds,
      }),
    });

    if (!response.ok) {
      let errorMessage = "Failed to save activity to history";

      try {
        const payload = (await response.json()) as { error?: string };

        if (payload.error) {
          errorMessage = payload.error;
        }
      } catch {
        // Ignore response parsing issues and fall back to the generic message.
      }

      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error("Failed to save attempt:", err);

    toast.error(
      err instanceof Error && err.message
        ? err.message
        : "Failed to save activity to history",
    );
  }
}
