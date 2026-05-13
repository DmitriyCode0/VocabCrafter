interface QuizSnapshotInput {
  title?: unknown;
  type?: unknown;
  cefr_level?: unknown;
  vocabulary_terms?: unknown;
  generated_content?: unknown;
  config?: unknown;
  deleted_at?: unknown;
}

interface QuizSnapshotVocabularyTerm extends Record<string, unknown> {
  term: string;
  definition: string;
}

export interface QuizSnapshotData {
  title: string | null;
  type: string | null;
  cefr_level: string | null;
  vocabulary_terms: QuizSnapshotVocabularyTerm[];
  generated_content: Record<string, unknown>;
  config: Record<string, unknown> | null;
  deleted_at?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function asVocabularyTermArray(value: unknown): QuizSnapshotVocabularyTerm[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);

    if (
      !record ||
      typeof record.term !== "string" ||
      typeof record.definition !== "string"
    ) {
      return [];
    }

    return [
      {
        ...record,
        term: record.term,
        definition: record.definition,
      },
    ];
  });
}

export function buildQuizSnapshot(quiz: QuizSnapshotInput) {
  return {
    title: typeof quiz.title === "string" ? quiz.title : null,
    type: typeof quiz.type === "string" ? quiz.type : null,
    cefr_level: typeof quiz.cefr_level === "string" ? quiz.cefr_level : null,
    vocabulary_terms: asVocabularyTermArray(quiz.vocabulary_terms),
    generated_content: asRecord(quiz.generated_content) ?? {},
    config: asRecord(quiz.config),
  } satisfies Record<string, unknown>;
}

export function parseQuizSnapshot(value: unknown): QuizSnapshotData | null {
  const snapshot = asRecord(value);

  if (!snapshot) {
    return null;
  }

  return {
    title: typeof snapshot.title === "string" ? snapshot.title : null,
    type: typeof snapshot.type === "string" ? snapshot.type : null,
    cefr_level:
      typeof snapshot.cefr_level === "string" ? snapshot.cefr_level : null,
    vocabulary_terms: asVocabularyTermArray(snapshot.vocabulary_terms),
    generated_content: asRecord(snapshot.generated_content) ?? {},
    config: asRecord(snapshot.config),
    deleted_at:
      typeof snapshot.deleted_at === "string" ? snapshot.deleted_at : null,
  };
}

export function resolveAttemptQuiz(
  value:
    | {
        quizzes?: unknown;
        quiz_snapshot?: unknown;
      }
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  const liveQuiz = parseQuizSnapshot(value.quizzes);
  const snapshot = parseQuizSnapshot(value.quiz_snapshot);

  if (!liveQuiz) {
    return snapshot;
  }

  if (!liveQuiz.deleted_at || !snapshot) {
    return liveQuiz;
  }

  return {
    title: snapshot.title ?? liveQuiz.title,
    type: snapshot.type ?? liveQuiz.type,
    cefr_level: snapshot.cefr_level ?? liveQuiz.cefr_level,
    vocabulary_terms:
      snapshot.vocabulary_terms.length > 0
        ? snapshot.vocabulary_terms
        : liveQuiz.vocabulary_terms,
    generated_content:
      Object.keys(snapshot.generated_content).length > 0
        ? snapshot.generated_content
        : liveQuiz.generated_content,
    config: snapshot.config ?? liveQuiz.config,
    deleted_at: liveQuiz.deleted_at,
  } satisfies QuizSnapshotData;
}