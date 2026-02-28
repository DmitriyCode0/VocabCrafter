export async function saveAttempt(
  quizId: string,
  answers: Record<string, unknown>,
  score: number | null,
  maxScore: number | null,
) {
  try {
    await fetch("/api/quiz-attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, answers, score, maxScore }),
    });
  } catch (err) {
    console.error("Failed to save attempt:", err);
  }
}
