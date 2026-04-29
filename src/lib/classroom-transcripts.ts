import { formatAppDateTime } from "@/lib/dates";
import {
  extractParsedStudentActiveVocabularyTermsFromTranscriptSegments,
  buildLessonTranscriptFullText,
  extractStudentActiveVocabularyTermsFromTranscriptSegments,
  normalizeLessonTranscriptSegments,
  type LessonTranscriptSegmentInput,
  type LessonTranscriptSpeakerRole,
} from "@/lib/lesson-room-transcripts";

export type ClassroomTranscriptSpeakerRole = LessonTranscriptSpeakerRole;
export type ClassroomTranscriptSegmentInput = LessonTranscriptSegmentInput;

export const normalizeClassroomTranscriptSegments =
  normalizeLessonTranscriptSegments;
export const buildClassroomTranscriptFullText = buildLessonTranscriptFullText;
export const extractStudentActiveVocabularyTermsFromClassroomTranscriptSegments =
  extractStudentActiveVocabularyTermsFromTranscriptSegments;
export const extractParsedStudentActiveVocabularyTermsFromClassroomTranscriptSegments =
  extractParsedStudentActiveVocabularyTermsFromTranscriptSegments;

export function buildClassroomActiveEvidenceSourceLabel({
  tutorName,
  studentName,
  recordedAt,
}: {
  tutorName: string;
  studentName: string;
  recordedAt: string;
}) {
  return `Classroom - ${tutorName} & ${studentName} - ${formatAppDateTime(recordedAt)}`;
}