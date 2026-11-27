import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkAIQuota, incrementAICalls } from "@/lib/ai/quota";
import { recordAIUsageEvent } from "@/lib/ai/usage";
import {
  GEMINI_MODEL,
  generateFromGeminiWithUsage,
} from "@/lib/gemini/client";
import {
  parseGoogleMeetTranscriptText,
  type MeetTranscriptTurn,
} from "@/lib/google-meet-transcripts";
import { normalizeLearningLanguage } from "@/lib/languages";
import { upsertActiveVocabularyEvidence } from "@/lib/mastery/active-vocabulary-evidence";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  getPassiveVocabularyCompositeKey,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyUkrainianTranslation,
  inferPassiveVocabularyItemType,
  normalizePassiveVocabularyText,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import { resolvePassiveVocabularyLibraryItems } from "@/lib/mastery/passive-vocabulary-library";
import {
  lookupReferenceDictionaryEntries,
  type ReferenceDictionaryEntry,
} from "@/lib/mastery/reference-dictionary";
import {
  markStudentVocabularyStateAsLearning,
  syncStudentVocabularyStateFromPassiveEvidence,
} from "@/lib/mastery/student-vocabulary-state";
import type { Database, Json } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

const MAX_TRANSCRIPT_CHARS_FOR_AI = 24000;

const VALID_PARTS_OF_SPEECH = new Set<string>(PASSIVE_VOCABULARY_PARTS_OF_SPEECH);
const VALID_CEFR_LEVELS = new Set<string>(PASSIVE_VOCABULARY_CEFR_LEVELS);

function toValidPartOfSpeech(
  value: string | null | undefined,
): PassiveVocabularyPartOfSpeech | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (VALID_PARTS_OF_SPEECH.has(normalized)) {
    return normalized as PassiveVocabularyPartOfSpeech;
  }
  return undefined;
}

function toValidCefrLevel(
  value: string | null | undefined,
): PassiveVocabularyLibraryCefrLevel | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (VALID_CEFR_LEVELS.has(normalized)) {
    return normalized as PassiveVocabularyLibraryCefrLevel;
  }
  return null;
}

export interface TranscriptAutoAppliedActiveItem {
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  evidenceQuote: string | null;
  ukrainianTranslation: string | null;
  transcription: string | null;
  dictionaryMatched: boolean;
  graduatedFromLearning: boolean;
}

export interface TranscriptAutoAppliedPassiveItem {
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  contextQuote: string | null;
  ukrainianTranslation: string | null;
  transcription: string | null;
  dictionaryMatched: boolean;
}

export interface TranscriptLearningCandidateItem {
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  partOfSpeech: string | null;
  cefrLevel: string | null;
  ukrainianTranslation: string | null;
  englishDefinition: string | null;
  transcription: string | null;
  exampleSentence: string | null;
  reasonUk: string;
  confidence: "high" | "medium";
  dictionaryMatched: boolean;
  alreadyInLearning: boolean;
  status: "pending" | "approved" | "dismissed";
}

export interface LessonMeetTranscriptView {
  id: string;
  lessonId: string;
  studentId: string | null;
  sourceType: "google_drive" | "manual_paste" | "file_upload";
  googleDriveFileId: string | null;
  googleDriveFileName: string | null;
  googleDriveWebViewLink: string | null;
  analysisStatus: "pending" | "analyzed" | "learning_approved" | "failed";
  analysisError: string | null;
  lessonSummaryUk: string | null;
  speakers: Array<{
    name: string;
    role: "tutor" | "student" | "unknown";
    turnCount: number;
  }>;
  turnCount: number;
  autoAppliedActive: TranscriptAutoAppliedActiveItem[];
  autoAppliedPassive: TranscriptAutoAppliedPassiveItem[];
  learningCandidates: TranscriptLearningCandidateItem[];
  activeAppliedCount: number;
  passiveAppliedCount: number;
  learningApprovedCount: number;
  analyzedAt: string | null;
  learningReviewedAt: string | null;
  rawTextPreview: string;
}

const aiAnalysisResponseSchema = z.object({
  lessonSummaryUk: z.string().trim().max(1500).default(""),
  activeUsed: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        evidenceQuote: z.string().trim().max(260).optional().nullable(),
        ukrainianTranslation: z.string().trim().max(240).optional().nullable(),
      }),
    )
    .max(40)
    .default([]),
  passiveEncountered: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        contextQuote: z.string().trim().max(260).optional().nullable(),
        ukrainianTranslation: z.string().trim().max(240).optional().nullable(),
      }),
    )
    .max(45)
    .default([]),
  learningCandidates: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        partOfSpeech: z.string().trim().max(40).optional().nullable(),
        cefrLevel: z.string().trim().max(10).optional().nullable(),
        ukrainianTranslation: z.string().trim().max(240).optional().nullable(),
        englishDefinition: z.string().trim().max(320).optional().nullable(),
        exampleSentence: z.string().trim().max(320).optional().nullable(),
        reasonUk: z.string().trim().max(320).default(""),
        confidence: z.enum(["high", "medium"]).default("medium"),
      }),
    )
    .max(20)
    .default([]),
});

function truncateTranscriptForAI(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_TRANSCRIPT_CHARS_FOR_AI) {
    return clean;
  }
  const headChars = Math.floor(MAX_TRANSCRIPT_CHARS_FOR_AI * 0.55);
  const tailChars = MAX_TRANSCRIPT_CHARS_FOR_AI - headChars - 64;
  return `${clean.slice(0, headChars)}\n\n[... middle of lesson transcript omitted ...]\n\n${clean.slice(-tailChars)}`;
}

function formatTranscriptForPrompt(
  turns: MeetTranscriptTurn[],
  normalizedRawText: string,
): string {
  if (turns.length === 0) {
    return truncateTranscriptForAI(normalizedRawText);
  }
  const formatted = turns
    .map((turn) => {
      const roleTag =
        turn.speakerRole === "student"
          ? "[STUDENT]"
          : turn.speakerRole === "tutor"
            ? "[TUTOR]"
            : "[SPEAKER]";
      const ts = turn.timestamp ? ` (${turn.timestamp})` : "";
      return `${roleTag} ${turn.speakerName}${ts}: ${turn.text}`;
    })
    .join("\n");

  return truncateTranscriptForAI(formatted);
}

function summarizeTranscriptSpeakers(turns: MeetTranscriptTurn[]) {
  const map = new Map<
    string,
    { name: string; role: "tutor" | "student" | "unknown"; turnCount: number }
  >();
  for (const turn of turns) {
    const key = turn.speakerName.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.turnCount += 1;
    } else {
      map.set(key, {
        name: turn.speakerName,
        role: turn.speakerRole,
        turnCount: 1,
      });
    }
  }
  return Array.from(map.values());
}

export function mapLessonMeetTranscriptRowToView(
  row: Database["public"]["Tables"]["lesson_meet_transcripts"]["Row"],
): LessonMeetTranscriptView {
  const turns = Array.isArray(row.parsed_segments)
    ? (row.parsed_segments as unknown as MeetTranscriptTurn[])
    : [];

  return {
    id: row.id,
    lessonId: row.lesson_id,
    studentId: row.student_id,
    sourceType: row.source_type,
    googleDriveFileId: row.google_drive_file_id,
    googleDriveFileName: row.google_drive_file_name,
    googleDriveWebViewLink: row.google_drive_web_view_link,
    analysisStatus: row.analysis_status,
    analysisError: row.analysis_error,
    lessonSummaryUk: row.lesson_summary_uk,
    speakers: summarizeTranscriptSpeakers(turns),
    turnCount: turns.length,
    autoAppliedActive: Array.isArray(row.auto_applied_active)
      ? (row.auto_applied_active as unknown as TranscriptAutoAppliedActiveItem[])
      : [],
    autoAppliedPassive: Array.isArray(row.auto_applied_passive)
      ? (row.auto_applied_passive as unknown as TranscriptAutoAppliedPassiveItem[])
      : [],
    learningCandidates: Array.isArray(row.learning_candidates)
      ? (row.learning_candidates as unknown as TranscriptLearningCandidateItem[])
      : [],
    activeAppliedCount: row.active_applied_count,
    passiveAppliedCount: row.passive_applied_count,
    learningApprovedCount: row.learning_approved_count,
    analyzedAt: row.analyzed_at,
    learningReviewedAt: row.learning_reviewed_at,
    rawTextPreview:
      row.raw_text.length > 4000
        ? `${row.raw_text.slice(0, 4000)}\n...`
        : row.raw_text,
  };
}

function getLookupEntryForTerm(
  dictMap: Map<string, ReferenceDictionaryEntry>,
  term: string,
): ReferenceDictionaryEntry | undefined {
  const normalized = normalizePassiveVocabularyText(term);
  return dictMap.get(normalized);
}

export async function analyzeLessonTranscriptAndAutoApply({
  lessonId,
  tutorId,
  tutorName,
  studentId,
  studentName,
  lessonTitle,
  lessonDate,
  sourceType,
  googleDriveFileId = null,
  googleDriveFileName = null,
  googleDriveWebViewLink = null,
  rawText,
  adminClient,
}: {
  lessonId: string;
  tutorId: string;
  tutorName: string | null;
  studentId: string | null;
  studentName: string | null;
  lessonTitle: string | null;
  lessonDate: string;
  sourceType: "google_drive" | "manual_paste" | "file_upload";
  googleDriveFileId?: string | null;
  googleDriveFileName?: string | null;
  googleDriveWebViewLink?: string | null;
  rawText: string;
  adminClient: SupabaseAdminClient;
}): Promise<LessonMeetTranscriptView> {
  if (!studentId) {
    throw new Error(
      "Assign a student to this lesson before syncing transcript vocabulary.",
    );
  }

  const parsed = parseGoogleMeetTranscriptText(rawText, {
    tutorName,
    studentName,
  });

  if (!parsed.normalizedText) {
    throw new Error("The transcript text is empty.");
  }

  const quota = await checkAIQuota(tutorId);
  if (!quota.allowed) {
    throw new Error(
      `Monthly AI limit reached (${quota.used}/${quota.limit}).`,
    );
  }

  // Load student context + existing vocabulary states
  const [studentProfileRes, studentVocabRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("full_name, cefr_level, preferred_language")
      .eq("id", studentId)
      .maybeSingle(),
    adminClient
      .from("student_vocabulary_items")
      .select("normalized_term, item_type, current_state")
      .eq("student_id", studentId),
  ]);

  const studentCefr = toValidCefrLevel(studentProfileRes.data?.cefr_level) ?? "B1";
  const targetLanguage = normalizeLearningLanguage(
    studentProfileRes.data?.preferred_language,
  );

  const existingLearningSet = new Set<string>();
  const existingActiveSet = new Set<string>();
  const existingPassiveSet = new Set<string>();

  for (const row of studentVocabRes.data ?? []) {
    if (row.current_state === "learning") {
      existingLearningSet.add(row.normalized_term);
    } else if (row.current_state === "active_and_passive") {
      existingActiveSet.add(row.normalized_term);
    } else if (row.current_state === "passive_only") {
      existingPassiveSet.add(row.normalized_term);
    }
  }

  const promptTranscript = formatTranscriptForPrompt(
    parsed.turns,
    parsed.normalizedText,
  );
  const learningSample = Array.from(existingLearningSet).slice(0, 60);

  const systemInstruction = [
    "You are an expert ESL/EFL linguistics analyst for an English learning platform for Ukrainian-speaking students.",
    "Analyze a Google Meet lesson transcript between a Tutor and a Student.",
    "Classify vocabulary cleanly into 3 categories:",
    "1) activeUsed: meaningful non-trivial English words, collocations, or phrasal verbs that the STUDENT genuinely produced naturally and meaningfully in speech (excluding basic grammar/stopwords like 'the', 'yes', 'okay', 'good', 'hello', 'think'). Normalize verbs/nouns to base dictionary lemma (infinitive/singular).",
    "2) passiveEncountered: meaningful target vocabulary discussed by the tutor, read aloud, or appearing in lesson context that the student understood/encountered passively (not already in activeUsed).",
    "3) learningCandidates: ONLY the most valuable words/phrases the student explicitly asked about, stumbled over, couldn't recall, misused, needed a Ukrainian explanation for, or that the tutor highlighted as new target vocabulary to drill with spaced repetition.",
    "Exclude all Ukrainian words as target terms; translate meanings concisely into natural Ukrainian.",
    "Return strictly valid JSON matching the requested schema.",
  ].join(" ");

  const prompt = [
    `Lesson Date: ${lessonDate}`,
    `Lesson Title: ${lessonTitle || "1-on-1 English Lesson"}`,
    `Tutor: ${tutorName || "Tutor"}`,
    `Student: ${studentName || studentProfileRes.data?.full_name || "Student"}`,
    `Student CEFR Level: ${studentCefr}`,
    learningSample.length > 0
      ? `Words already in Student's Learning deck (if the student uses any of these naturally in speech, include them in activeUsed): ${learningSample.join(", ")}`
      : "",
    "",
    "Respond in this exact JSON format:",
    JSON.stringify(
      {
        lessonSummaryUk: "Короткий підсумок уроку українською (2-3 речення).",
        activeUsed: [
          {
            term: "cope with",
            evidenceQuote: "Student sentence excerpt showing usage",
            ukrainianTranslation: "впоратися з",
          },
        ],
        passiveEncountered: [
          {
            term: "resilient",
            contextQuote: "Excerpt where tutor or material introduced it",
            ukrainianTranslation: "стійкий, витривалий",
          },
        ],
        learningCandidates: [
          {
            term: "reluctant",
            partOfSpeech: "adjective",
            cefrLevel: "B2",
            ukrainianTranslation: "неохочий",
            englishDefinition: "unwilling and hesitant",
            exampleSentence: "Natural short example sentence from or matching the lesson",
            reasonUk: "Учень вагався з перекладом / спитав значення слова",
            confidence: "high",
          },
        ],
      },
      null,
      2,
    ),
    "",
    "--- TRANSCRIPT START ---",
    promptTranscript,
    "--- TRANSCRIPT END ---",
  ]
    .filter(Boolean)
    .join("\n");

  const aiResult = await generateFromGeminiWithUsage(
    {
      prompt,
      systemInstruction,
      temperature: 0.2,
    },
    aiAnalysisResponseSchema,
  );

  await Promise.all([
    incrementAICalls(tutorId),
    recordAIUsageEvent({
      userId: tutorId,
      feature: "lesson_transcript_vocab",
      requestType: "text",
      model: GEMINI_MODEL,
      snapshot: aiResult.usageSnapshot,
      adminClient,
    }),
  ]);

  // Deduplicate and enforce category disjointness (Active > Learning > Passive)
  const activeDeduped = new Map<
    string,
    {
      term: string;
      normalizedTerm: string;
      itemType: "word" | "phrase";
      evidenceQuote: string | null;
      ukrainianTranslation: string | null;
    }
  >();

  for (const rawItem of aiResult.data.activeUsed) {
    const normalized = normalizePassiveVocabularyText(rawItem.term);
    if (!normalized || normalized.length < 2) continue;
    if (!activeDeduped.has(normalized)) {
      activeDeduped.set(normalized, {
        term: normalized,
        normalizedTerm: normalized,
        itemType: inferPassiveVocabularyItemType(normalized),
        evidenceQuote: rawItem.evidenceQuote ?? null,
        ukrainianTranslation: rawItem.ukrainianTranslation ?? null,
      });
    }
  }

  const learningDeduped = new Map<
    string,
    {
      term: string;
      normalizedTerm: string;
      itemType: "word" | "phrase";
      partOfSpeech: string | null;
      cefrLevel: string | null;
      ukrainianTranslation: string | null;
      englishDefinition: string | null;
      exampleSentence: string | null;
      reasonUk: string;
      confidence: "high" | "medium";
    }
  >();

  for (const rawItem of aiResult.data.learningCandidates) {
    const normalized = normalizePassiveVocabularyText(rawItem.term);
    if (!normalized || normalized.length < 2) continue;
    if (activeDeduped.has(normalized) || existingLearningSet.has(normalized)) {
      continue;
    }
    if (!learningDeduped.has(normalized)) {
      learningDeduped.set(normalized, {
        term: normalized,
        normalizedTerm: normalized,
        itemType: inferPassiveVocabularyItemType(normalized),
        partOfSpeech: toValidPartOfSpeech(rawItem.partOfSpeech) ?? null,
        cefrLevel: toValidCefrLevel(rawItem.cefrLevel),
        ukrainianTranslation: rawItem.ukrainianTranslation ?? null,
        englishDefinition: rawItem.englishDefinition ?? null,
        exampleSentence: rawItem.exampleSentence ?? null,
        reasonUk:
          rawItem.reasonUk?.trim() || "Рекомендовано для повторення з уроку",
        confidence: rawItem.confidence,
      });
    }
  }

  const passiveDeduped = new Map<
    string,
    {
      term: string;
      normalizedTerm: string;
      itemType: "word" | "phrase";
      contextQuote: string | null;
      ukrainianTranslation: string | null;
    }
  >();

  for (const rawItem of aiResult.data.passiveEncountered) {
    const normalized = normalizePassiveVocabularyText(rawItem.term);
    if (!normalized || normalized.length < 2) continue;
    if (activeDeduped.has(normalized) || learningDeduped.has(normalized)) {
      continue;
    }
    if (!passiveDeduped.has(normalized)) {
      passiveDeduped.set(normalized, {
        term: normalized,
        normalizedTerm: normalized,
        itemType: inferPassiveVocabularyItemType(normalized),
        contextQuote: rawItem.contextQuote ?? null,
        ukrainianTranslation: rawItem.ukrainianTranslation ?? null,
      });
    }
  }

  // Layer 1 reference dictionary lookup across all extracted terms
  const allTerms = Array.from(
    new Set([
      ...activeDeduped.keys(),
      ...passiveDeduped.keys(),
      ...learningDeduped.keys(),
    ]),
  );
  const dictMap = await lookupReferenceDictionaryEntries(adminClient, allTerms);

  const sourceLabel = `Meet Lesson · ${lessonDate}${lessonTitle ? ` · ${lessonTitle}` : ""}`;

  // 1) Silently auto-apply Active Vocabulary evidence
  const activeItemsList = Array.from(activeDeduped.values());
  if (activeItemsList.length > 0) {
    await upsertActiveVocabularyEvidence({
      adminClient,
      studentId,
      actorUserId: tutorId,
      targetLanguage,
      terms: activeItemsList.map((item) => item.term),
      sourceType: "lesson_recording",
      sourceLabel,
      usedAt: new Date(`${lessonDate}T12:00:00Z`).toISOString(),
    });
  }

  // 2) Silently auto-apply Passive Vocabulary evidence + sync state
  const passiveItemsList = Array.from(passiveDeduped.values());
  if (passiveItemsList.length > 0) {
    const libraryResolutions = await resolvePassiveVocabularyLibraryItems({
      adminClient,
      actorUserId: tutorId,
      targetLanguage,
      items: passiveItemsList.map((item) => {
        const dictEntry = getLookupEntryForTerm(dictMap, item.term);
        return {
          term: item.term,
          normalizedTerm: item.normalizedTerm,
          itemType: item.itemType,
          ukrainianTranslation:
            item.ukrainianTranslation ?? dictEntry?.shortUkTranslation ?? null,
          partOfSpeech: toValidPartOfSpeech(dictEntry?.partOfSpeech),
        };
      }),
    });

    const acceptedPassive = libraryResolutions.filter(
      (res) => res.approvalStatus !== "rejected",
    );

    if (acceptedPassive.length > 0) {
      const canonicalMap = new Map<
        string,
        {
          term: string;
          normalizedTerm: string;
          itemType: "word" | "phrase";
          libraryItemId: string | null;
          definition: string | null;
        }
      >();

      for (const resolution of acceptedPassive) {
        const key = getPassiveVocabularyCompositeKey(
          resolution.canonicalNormalizedTerm,
          resolution.itemType,
        );
        if (canonicalMap.has(key)) continue;

        const sourceInput = passiveDeduped.get(resolution.requestedNormalizedTerm);
        const dictEntry = getLookupEntryForTerm(
          dictMap,
          resolution.canonicalNormalizedTerm,
        );
        const translation =
          getPassiveVocabularyUkrainianTranslation(resolution.attributes) ||
          sourceInput?.ukrainianTranslation ||
          dictEntry?.shortUkTranslation ||
          getPassiveVocabularyEnglishDefinitions(resolution.attributes)[0] ||
          null;

        canonicalMap.set(key, {
          term: resolution.canonicalTerm,
          normalizedTerm: resolution.canonicalNormalizedTerm,
          itemType: resolution.itemType,
          libraryItemId: resolution.libraryItemId,
          definition: translation,
        });
      }

      const canonicalList = Array.from(canonicalMap.values());
      const { data: existingPassiveRows } = await adminClient
        .from("passive_vocabulary_evidence")
        .select(
          "normalized_term, item_type, definition, source_label, import_count, library_item_id",
        )
        .eq("student_id", studentId)
        .in(
          "normalized_term",
          canonicalList.map((item) => item.normalizedTerm),
        );

      const existingPassiveMap = new Map(
        (existingPassiveRows ?? []).map((row) => [
          getPassiveVocabularyCompositeKey(row.normalized_term, row.item_type),
          row,
        ]),
      );
      const nowIso = new Date().toISOString();

      const upsertPassiveRows = canonicalList.map((item) => {
        const existing = existingPassiveMap.get(
          getPassiveVocabularyCompositeKey(item.normalizedTerm, item.itemType),
        );
        return {
          student_id: studentId,
          imported_by: tutorId,
          term: item.term,
          normalized_term: item.normalizedTerm,
          library_item_id: item.libraryItemId ?? existing?.library_item_id ?? null,
          definition: item.definition ?? existing?.definition ?? null,
          item_type: item.itemType,
          source_type: "full_text" as const,
          source_label: sourceLabel,
          import_count: (existing?.import_count ?? 0) + 1,
          last_imported_at: nowIso,
          updated_at: nowIso,
        };
      });

      const { error: passiveUpsertError } = await adminClient
        .from("passive_vocabulary_evidence")
        .upsert(upsertPassiveRows, {
          onConflict: "student_id,normalized_term,item_type",
        });

      if (passiveUpsertError) {
        console.error(
          "Lesson transcript passive vocabulary upsert error:",
          passiveUpsertError,
        );
      } else {
        await syncStudentVocabularyStateFromPassiveEvidence({
          adminClient,
          studentId,
          items: canonicalList.map((item) => ({
            term: item.term,
            normalizedTerm: item.normalizedTerm,
            itemType: item.itemType,
            libraryItemId: item.libraryItemId,
          })),
        });
      }
    }
  }

  // Build structured UI snapshots enriched with Layer 1 dictionary metadata
  const autoAppliedActive: TranscriptAutoAppliedActiveItem[] = activeItemsList.map(
    (item) => {
      const dictEntry = getLookupEntryForTerm(dictMap, item.term);
      return {
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        evidenceQuote: item.evidenceQuote,
        ukrainianTranslation:
          dictEntry?.shortUkTranslation ?? item.ukrainianTranslation ?? null,
        transcription: dictEntry?.ipaUs ?? dictEntry?.ipaUk ?? null,
        dictionaryMatched: Boolean(dictEntry),
        graduatedFromLearning: existingLearningSet.has(item.normalizedTerm),
      };
    },
  );

  const autoAppliedPassive: TranscriptAutoAppliedPassiveItem[] =
    passiveItemsList.map((item) => {
      const dictEntry = getLookupEntryForTerm(dictMap, item.term);
      return {
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        contextQuote: item.contextQuote,
        ukrainianTranslation:
          dictEntry?.shortUkTranslation ?? item.ukrainianTranslation ?? null,
        transcription: dictEntry?.ipaUs ?? dictEntry?.ipaUk ?? null,
        dictionaryMatched: Boolean(dictEntry),
      };
    });

  const learningCandidates: TranscriptLearningCandidateItem[] = Array.from(
    learningDeduped.values(),
  ).map((item) => {
    const dictEntry = getLookupEntryForTerm(dictMap, item.term);
    return {
      term: item.term,
      normalizedTerm: item.normalizedTerm,
      itemType: item.itemType,
      partOfSpeech: item.partOfSpeech ?? dictEntry?.partOfSpeech ?? null,
      cefrLevel: item.cefrLevel,
      ukrainianTranslation:
        item.ukrainianTranslation ?? dictEntry?.shortUkTranslation ?? null,
      englishDefinition: item.englishDefinition ?? null,
      transcription: dictEntry?.ipaUs ?? dictEntry?.ipaUk ?? null,
      exampleSentence: item.exampleSentence ?? null,
      reasonUk: item.reasonUk,
      confidence: item.confidence,
      dictionaryMatched: Boolean(dictEntry),
      alreadyInLearning: existingLearningSet.has(item.normalizedTerm),
      status: "pending",
    };
  });

  const nowIso = new Date().toISOString();
  const { data: savedRow, error: saveError } = await adminClient
    .from("lesson_meet_transcripts")
    .upsert(
      {
        lesson_id: lessonId,
        tutor_id: tutorId,
        student_id: studentId,
        source_type: sourceType,
        google_drive_file_id: googleDriveFileId,
        google_drive_file_name: googleDriveFileName,
        google_drive_web_view_link: googleDriveWebViewLink,
        raw_text: parsed.normalizedText,
        parsed_segments: parsed.turns as unknown as Json,
        analysis_status: "analyzed",
        analysis_error: null,
        lesson_summary_uk: aiResult.data.lessonSummaryUk || null,
        auto_applied_active: autoAppliedActive as unknown as Json,
        auto_applied_passive: autoAppliedPassive as unknown as Json,
        learning_candidates: learningCandidates as unknown as Json,
        active_applied_count: autoAppliedActive.length,
        passive_applied_count: autoAppliedPassive.length,
        learning_approved_count: 0,
        analyzed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "lesson_id" },
    )
    .select("*")
    .single();

  if (saveError || !savedRow) {
    console.error("Failed to save lesson meet transcript:", saveError);
    throw new Error("Failed to save analyzed Meet transcript.");
  }

  return mapLessonMeetTranscriptRowToView(savedRow);
}

export async function approveLessonLearningCandidates({
  lessonId,
  tutorId,
  approvedItems,
  adminClient,
}: {
  lessonId: string;
  tutorId: string;
  approvedItems: Array<{
    term: string;
    ukrainianTranslation?: string | null;
    englishDefinition?: string | null;
    partOfSpeech?: string | null;
  }>;
  adminClient: SupabaseAdminClient;
}): Promise<{
  transcript: LessonMeetTranscriptView;
  addedCount: number;
  skippedExistingCount: number;
}> {
  const { data: transcriptRow, error: fetchError } = await adminClient
    .from("lesson_meet_transcripts")
    .select("*")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (fetchError) {
    throw new Error("Failed to load lesson transcript.");
  }

  if (!transcriptRow) {
    throw new Error("Transcript not found for this lesson.");
  }

  if (transcriptRow.tutor_id !== tutorId) {
    throw new Error("You do not have access to this transcript.");
  }

  const studentId = transcriptRow.student_id;
  if (!studentId) {
    throw new Error("This lesson does not have an assigned student.");
  }

  const { data: studentProfile } = await adminClient
    .from("profiles")
    .select("preferred_language")
    .eq("id", studentId)
    .maybeSingle();

  const targetLanguage = normalizeLearningLanguage(
    studentProfile?.preferred_language,
  );

  const normalizedApprovedMap = new Map<
    string,
    {
      term: string;
      normalizedTerm: string;
      itemType: "word" | "phrase";
      ukrainianTranslation: string | null;
      englishDefinition: string | null;
      partOfSpeech: PassiveVocabularyPartOfSpeech | undefined;
    }
  >();

  for (const item of approvedItems) {
    const normalized = normalizePassiveVocabularyText(item.term);
    if (!normalized) continue;
    normalizedApprovedMap.set(normalized, {
      term: normalized,
      normalizedTerm: normalized,
      itemType: inferPassiveVocabularyItemType(normalized),
      ukrainianTranslation: item.ukrainianTranslation?.trim() || null,
      englishDefinition: item.englishDefinition?.trim() || null,
      partOfSpeech: toValidPartOfSpeech(item.partOfSpeech),
    });
  }

  const nowIso = new Date().toISOString();
  const approvedList = Array.from(normalizedApprovedMap.values());
  let addedCount = 0;
  let skippedExistingCount = 0;

  if (approvedList.length > 0) {
    const resolutions = await resolvePassiveVocabularyLibraryItems({
      adminClient,
      actorUserId: tutorId,
      targetLanguage,
      items: approvedList.map((item) => ({
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        partOfSpeech: item.partOfSpeech,
        ukrainianTranslation: item.ukrainianTranslation,
        englishDefinitions: item.englishDefinition
          ? [item.englishDefinition]
          : undefined,
      })),
    });

    const canonicalTerms = resolutions.map((r) => r.canonicalTerm);
    const { data: existingMasteryRows, error: existingMasteryError } =
      await adminClient
        .from("word_mastery")
        .select("id, term, definition")
        .eq("student_id", studentId)
        .in("term", canonicalTerms);

    if (existingMasteryError) {
      throw new Error("Failed to check existing student vocabulary.");
    }

    const existingMasteryMap = new Map(
      (existingMasteryRows ?? []).map((row) => [
        row.term.toLowerCase(),
        row,
      ]),
    );

    const rowsToInsert: Array<{
      student_id: string;
      term: string;
      definition: string;
      mastery_level: number;
      next_review: string;
    }> = [];

    for (const resolution of resolutions) {
      const input = normalizedApprovedMap.get(
        resolution.requestedNormalizedTerm,
      );
      const definition =
        input?.ukrainianTranslation ||
        getPassiveVocabularyUkrainianTranslation(resolution.attributes) ||
        input?.englishDefinition ||
        getPassiveVocabularyEnglishDefinitions(resolution.attributes)[0] ||
        resolution.canonicalTerm;

      const existing = existingMasteryMap.get(
        resolution.canonicalTerm.toLowerCase(),
      );
      if (existing) {
        skippedExistingCount += 1;
        if (!(existing.definition ?? "").trim() && definition.trim()) {
          await adminClient
            .from("word_mastery")
            .update({ definition })
            .eq("id", existing.id);
        }
        continue;
      }

      if (
        !rowsToInsert.some(
          (r) => r.term.toLowerCase() === resolution.canonicalTerm.toLowerCase(),
        )
      ) {
        rowsToInsert.push({
          student_id: studentId,
          term: resolution.canonicalTerm,
          definition,
          mastery_level: 0,
          next_review: nowIso,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await adminClient
        .from("word_mastery")
        .insert(rowsToInsert);

      if (insertError) {
        console.error("Failed to insert approved word_mastery rows:", insertError);
        throw new Error("Failed to add approved words to student's Learning list.");
      }
      addedCount = rowsToInsert.length;
    }

    await markStudentVocabularyStateAsLearning({
      adminClient,
      studentId,
      items: resolutions.map((resolution) => ({
        term: resolution.canonicalTerm,
        normalizedTerm: resolution.canonicalNormalizedTerm,
        itemType: resolution.itemType,
        libraryItemId: resolution.libraryItemId,
      })),
    });
  }

  const existingCandidates = Array.isArray(transcriptRow.learning_candidates)
    ? (transcriptRow.learning_candidates as unknown as TranscriptLearningCandidateItem[])
    : [];

  const updatedCandidates: TranscriptLearningCandidateItem[] =
    existingCandidates.map((candidate) => {
      const approved = normalizedApprovedMap.get(candidate.normalizedTerm);
      if (approved) {
        return {
          ...candidate,
          ukrainianTranslation:
            approved.ukrainianTranslation ?? candidate.ukrainianTranslation,
          status: "approved",
        };
      }
      if (candidate.status === "pending") {
        return {
          ...candidate,
          status: "dismissed",
        };
      }
      return candidate;
    });

  const approvedTotal = updatedCandidates.filter(
    (c) => c.status === "approved",
  ).length;

  const { data: updatedRow, error: updateError } = await adminClient
    .from("lesson_meet_transcripts")
    .update({
      learning_candidates: updatedCandidates as unknown as Json,
      learning_approved_count: approvedTotal,
      analysis_status: "learning_approved",
      learning_reviewed_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", transcriptRow.id)
    .select("*")
    .single();

  if (updateError || !updatedRow) {
    throw new Error("Failed to update transcript review state.");
  }

  return {
    transcript: mapLessonMeetTranscriptRowToView(updatedRow),
    addedCount,
    skippedExistingCount,
  };
}
