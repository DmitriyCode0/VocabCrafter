"use client";

import { Badge } from "@/components/ui/badge";

interface AttemptDetailProps {
  attempt: Record<string, unknown>;
}

interface GapFillResult {
  sentence?: string;
  userAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
}

interface MCQResult {
  question?: string;
  selected?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
}

interface TranslationResult {
  ukrainianSentence?: string;
  userTranslation?: string;
  referenceTranslation?: string;
  score?: number;
  feedback?: string;
}

interface MatchingResult {
  term?: string;
  selected?: string;
  correct?: string;
  isCorrect?: boolean;
}

export function AttemptDetail({ attempt }: AttemptDetailProps) {
  const quiz = attempt.quizzes as Record<string, unknown> | null;
  const rawAnswers = attempt.answers as Record<string, unknown> | null;
  const quizType = quiz?.type as string;

  if (!rawAnswers) {
    return (
      <p className="text-sm text-muted-foreground">
        No detailed answers recorded for this attempt.
      </p>
    );
  }

  const results = (rawAnswers.results ?? []) as Record<string, unknown>[];

  if (quizType === "gap_fill") {
    return <GapFillDetail results={results as unknown as GapFillResult[]} />;
  }

  if (quizType === "mcq") {
    return <MCQDetail results={results as unknown as MCQResult[]} />;
  }

  if (quizType === "translation") {
    return (
      <TranslationDetail
        results={results as unknown as TranslationResult[]}
      />
    );
  }

  if (quizType === "flashcards") {
    return <FlashcardDetail answers={rawAnswers} />;
  }

  if (quizType === "matching") {
    return <MatchingDetail results={results as unknown as MatchingResult[]} />;
  }

  // Generic fallback — show raw JSON
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Raw Answers</h4>
      <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
        {JSON.stringify(rawAnswers, null, 2)}
      </pre>
    </div>
  );
}

function GapFillDetail({ results }: { results: GapFillResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No answers recorded.</p>
    );
  }
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Gap Fill Answers</h4>
      {results.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 text-sm rounded px-3 py-2 ${
            r.isCorrect
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-red-50 dark:bg-red-950/30"
          }`}
        >
          <span className="font-mono text-muted-foreground shrink-0">
            Q{i + 1}:
          </span>
          <div className="flex-1 min-w-0">
            {r.sentence && (
              <p className="text-xs text-muted-foreground mb-1 truncate">
                {r.sentence}
              </p>
            )}
            <p>
              Answer: <strong>{r.userAnswer ?? "—"}</strong>
              {!r.isCorrect && r.correctAnswer && (
                <span className="text-muted-foreground ml-2">
                  (Correct: <strong>{r.correctAnswer}</strong>)
                </span>
              )}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`ml-auto shrink-0 text-xs ${r.isCorrect ? "text-green-600" : "text-red-600"}`}
          >
            {r.isCorrect ? "Correct" : "Wrong"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function MCQDetail({ results }: { results: MCQResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No answers recorded.</p>
    );
  }
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Multiple Choice Answers</h4>
      {results.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 text-sm rounded px-3 py-2 ${
            r.isCorrect
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-red-50 dark:bg-red-950/30"
          }`}
        >
          <span className="font-mono text-muted-foreground shrink-0">
            Q{i + 1}:
          </span>
          <div className="flex-1 min-w-0">
            {r.question && (
              <p className="text-xs text-muted-foreground mb-1">
                {r.question}
              </p>
            )}
            <p>
              Selected: <strong>{r.selected ?? "—"}</strong>
              {!r.isCorrect && r.correctAnswer && (
                <span className="text-muted-foreground ml-2">
                  (Correct: <strong>{r.correctAnswer}</strong>)
                </span>
              )}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`ml-auto shrink-0 text-xs ${r.isCorrect ? "text-green-600" : "text-red-600"}`}
          >
            {r.isCorrect ? "Correct" : "Wrong"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function TranslationDetail({ results }: { results: TranslationResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No answers recorded.</p>
    );
  }
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Translation Answers</h4>
      {results.map((r, i) => (
        <div key={i} className="bg-muted/50 rounded px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-muted-foreground">
              Q{i + 1}:
            </span>
            {r.score != null && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  r.score >= 80
                    ? "text-green-600"
                    : r.score >= 50
                      ? "text-orange-600"
                      : "text-red-600"
                }`}
              >
                {r.score}/100
              </Badge>
            )}
          </div>
          {r.ukrainianSentence && (
            <p className="text-sm text-muted-foreground">
              {r.ukrainianSentence}
            </p>
          )}
          {r.userTranslation && (
            <p className="text-sm">
              Student: <em>{r.userTranslation}</em>
            </p>
          )}
          {r.referenceTranslation && (
            <p className="text-sm text-muted-foreground">
              Reference: <em>{r.referenceTranslation}</em>
            </p>
          )}
          {r.feedback && (
            <div className="text-xs text-muted-foreground whitespace-pre-line mt-1">
              {r.feedback.split("\n").map((line, j) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("✓")) {
                  return (
                    <p key={j} className="text-green-600">
                      {trimmed}
                    </p>
                  );
                }
                if (trimmed.startsWith("✗")) {
                  return (
                    <p key={j} className="text-red-600">
                      {trimmed}
                    </p>
                  );
                }
                if (
                  trimmed.startsWith("Suggested") ||
                  trimmed.startsWith("suggested")
                ) {
                  return (
                    <p key={j} className="italic">
                      {trimmed}
                    </p>
                  );
                }
                return <p key={j}>{trimmed}</p>;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FlashcardDetail({
  answers,
}: {
  answers: Record<string, unknown>;
}) {
  const known = answers.known as number | undefined;
  const total = answers.total as number | undefined;

  return (
    <div className="text-sm text-muted-foreground">
      <p>
        Flashcard session —{" "}
        {known != null && total != null
          ? `${known} of ${total} cards marked as known`
          : "completed"}
        .
      </p>
    </div>
  );
}

function MatchingDetail({ results }: { results: MatchingResult[] }) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No answers recorded.</p>
    );
  }
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Matching Answers</h4>
      {results.map((r, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 text-sm rounded px-3 py-2 ${
            r.isCorrect
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-red-50 dark:bg-red-950/30"
          }`}
        >
          <span className="font-mono text-muted-foreground shrink-0">
            {i + 1}:
          </span>
          <div className="flex-1 min-w-0">
            <p>
              {r.term ?? "—"} → <strong>{r.selected ?? "—"}</strong>
              {!r.isCorrect && r.correct && (
                <span className="text-muted-foreground ml-2">
                  (Correct: <strong>{r.correct}</strong>)
                </span>
              )}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`ml-auto shrink-0 text-xs ${r.isCorrect ? "text-green-600" : "text-red-600"}`}
          >
            {r.isCorrect ? "Correct" : "Wrong"}
          </Badge>
        </div>
      ))}
    </div>
  );
}
