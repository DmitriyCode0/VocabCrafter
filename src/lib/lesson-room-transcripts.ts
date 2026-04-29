import { formatAppDate } from "@/lib/dates";
import { extractPassiveVocabularyTermOccurrencesFromText } from "@/lib/mastery/passive-vocabulary";
import type { TutorStudentLesson } from "@/types/database";

export type LessonTranscriptSpeakerRole =
  | "tutor"
  | "student"
  | "unknown"
  | "system";

export interface LessonTranscriptSegmentInput {
  speakerRole: LessonTranscriptSpeakerRole;
  speakerLabel?: string | null;
  startedAtSeconds?: number | null;
  endedAtSeconds?: number | null;
  content: string;
  confidence?: number | null;
  needsReview?: boolean;
}

export function normalizeLessonTranscriptSegments(
  segments: LessonTranscriptSegmentInput[] | undefined,
) {
  return (segments ?? []).map(
    (segment): LessonTranscriptSegmentInput => ({
      speakerRole: segment.speakerRole,
      speakerLabel: segment.speakerLabel?.trim() || null,
      startedAtSeconds: segment.startedAtSeconds ?? null,
      endedAtSeconds: segment.endedAtSeconds ?? null,
      content: segment.content.trim(),
      confidence: segment.confidence ?? null,
      needsReview: segment.needsReview ?? false,
    }),
  );
}

export function buildLessonTranscriptFullText(
  segments: Array<Pick<LessonTranscriptSegmentInput, "content">>,
) {
  const fullText = segments
    .map((segment) => segment.content.trim())
    .filter((content) => content.length > 0)
    .join("\n");

  return fullText.length > 0 ? fullText : null;
}

export function buildLessonActiveEvidenceSourceLabel(
  lesson: Pick<TutorStudentLesson, "title" | "lesson_date">,
) {
  const dateLabel = formatAppDate(lesson.lesson_date);
  const title = lesson.title?.trim();

  return title ? `${title} - ${dateLabel}` : `Lesson - ${dateLabel}`;
}

export function extractStudentActiveVocabularyTermsFromTranscriptSegments(
  segments: LessonTranscriptSegmentInput[],
) {
  const terms: string[] = [];

  for (const segment of segments) {
    if (segment.speakerRole !== "student") {
      continue;
    }

    terms.push(
      ...extractPassiveVocabularyTermOccurrencesFromText(segment.content),
    );
  }

  return terms;
}

export function extractParsedStudentActiveVocabularyTermsFromTranscriptSegments(
  segments: LessonTranscriptSegmentInput[],
) {
  return Array.from(
    new Set(extractStudentActiveVocabularyTermsFromTranscriptSegments(segments)),
  ).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}
