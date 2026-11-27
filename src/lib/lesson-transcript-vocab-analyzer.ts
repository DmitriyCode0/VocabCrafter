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
  extractPassiveVocabularyTermsFromText,
  getPassiveVocabularyCompositeKey,
  getPassiveVocabularyEnglishDefinitions,
  getPassiveVocabularyTranscription,
  getPassiveVocabularyUkrainianTranslation,
  inferPassiveVocabularyItemType,
  normalizePassiveVocabularyText,
  type PassiveVocabularyLibraryCefrLevel,
  type PassiveVocabularyPartOfSpeech,
} from "@/lib/mastery/passive-vocabulary";
import {
  lookupPassiveVocabularyLibraryItems,
  resolvePassiveVocabularyLibraryItems,
  type PassiveVocabularyLibraryResolution,
} from "@/lib/mastery/passive-vocabulary-library";
import {
  lookupReferenceDictionaryEntries,
  type ReferenceDictionaryEntry,
} from "@/lib/mastery/reference-dictionary";
import {
  markStudentVocabularyStateAsLearning,
  syncStudentVocabularyStateFromPassiveEvidence,
} from "@/lib/mastery/student-vocabulary-state";
import { isEnglishWord } from "@/lib/text/language-detection";
import type { Database, Json } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

const MAX_TRANSCRIPT_CHARS_FOR_AI = 120000;

const VALID_PARTS_OF_SPEECH = new Set<string>(PASSIVE_VOCABULARY_PARTS_OF_SPEECH);
const VALID_CEFR_LEVELS = new Set<string>(PASSIVE_VOCABULARY_CEFR_LEVELS);

const CEFR_PRIORITY_RANK: Record<string, number> = {
  C2: 6,
  C1: 5,
  B2: 4,
  B1: 3,
  A2: 1,
  A1: 0,
};

// Closed-class function words and speech-to-text fillers excluded from transcript diffs
const ENGLISH_STOPWORDS = new Set<string>([
  "the", "and", "but", "for", "nor", "yet", "are", "was", "were", "been", "being",
  "have", "has", "had", "having", "did", "does", "doing", "done", "will", "would",
  "shall", "should", "can", "could", "may", "might", "must", "not", "yes", "yeah",
  "yep", "nope", "nah", "okay", "ok", "hey", "hello", "bye", "hi", "hmm", "mhm",
  "uh", "um", "ah", "oh", "eh", "huh", "you", "your", "yours", "yourself", "she",
  "her", "hers", "herself", "him", "his", "himself", "they", "them", "their",
  "theirs", "themselves", "our", "ours", "ourselves", "its", "itself", "who",
  "whom", "whose", "which", "that", "this", "these", "those", "what", "where",
  "when", "why", "how", "all", "any", "both", "each", "few", "more", "most",
  "other", "others", "some", "such", "than", "too", "very", "just", "now", "then",
  "here", "there", "out", "off", "over", "under", "again", "once", "from", "into",
  "with", "without", "about", "against", "between", "through", "during", "before",
  "after", "above", "below", "down", "own", "same", "only", "also", "even", "still",
  "already", "always", "never", "well", "really", "actually", "basically", "maybe",
  "probably", "quite", "pretty", "much", "many", "lot", "lots", "bit", "little",
  "good", "bad", "nice", "fine", "great", "right", "sure", "true", "false", "one",
  "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "something", "anything", "nothing", "everything", "someone", "anyone", "everyone",
  "nobody", "somebody", "everybody", "somewhere", "anywhere", "nowhere", "everywhere",
  "because", "since", "while", "although", "though", "unless", "until", "whether",
  "like", "think", "know", "mean", "say", "said", "says", "see", "saw", "seen",
  "look", "want", "need", "use", "used", "using", "make", "made", "take", "took",
  "get", "got", "give", "gave", "put", "let", "try", "ask", "tell", "told", "work",
  "seem", "feel", "come", "came", "going", "goes", "went", "gone", "gonna", "wanna",
  "gotta", "kinda", "sorta", "don", "didn", "doesn", "won", "wouldn", "couldn",
  "shouldn", "isn", "aren", "wasn", "weren", "hasn", "haven", "hadn", "can't",
  "don't", "didn't", "doesn't", "won't", "wouldn't", "couldn't", "shouldn't",
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't", "i'm",
  "you're", "he's", "she's", "it's", "we're", "they're", "i've", "you've", "we've",
  "they've", "i'll", "you'll", "he'll", "she'll", "we'll", "they'll", "i'd",
  "you'd", "he'd", "she'd", "we'd", "they'd", "that's", "there's", "here's",
  "what's", "who's", "let's", "sorry", "please", "thank", "thanks", "today",
  "yesterday", "tomorrow", "lesson", "time", "day", "way", "thing", "things",
  "people", "person", "man", "woman", "part", "example",
]);

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

export type TranscriptCandidateStatus = "pending" | "approved" | "dismissed";

export interface TranscriptAutoAppliedActiveItem {
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  evidenceQuote: string | null;
  ukrainianTranslation: string | null;
  transcription: string | null;
  cefrLevel?: string | null;
  partOfSpeech?: string | null;
  dictionaryMatched: boolean;
  graduatedFromLearning: boolean;
  source?: "ai_phrase" | "transcript_scan" | "manual";
  status?: TranscriptCandidateStatus;
}

export interface TranscriptAutoAppliedPassiveItem {
  term: string;
  normalizedTerm: string;
  itemType: "word" | "phrase";
  contextQuote: string | null;
  ukrainianTranslation: string | null;
  transcription: string | null;
  cefrLevel?: string | null;
  partOfSpeech?: string | null;
  dictionaryMatched: boolean;
  source?: "ai_phrase" | "reading_aloud" | "transcript_scan" | "manual";
  status?: TranscriptCandidateStatus;
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
  status: TranscriptCandidateStatus;
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

const aiHybridAnalysisResponseSchema = z.object({
  lessonSummaryUk: z.string().trim().max(1500).default(""),
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
  activePhrases: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        evidenceQuote: z.string().trim().max(260).optional().nullable(),
        ukrainianTranslation: z.string().trim().max(240).optional().nullable(),
        cefrLevel: z.string().trim().max(10).optional().nullable(),
      }),
    )
    .max(80)
    .default([]),
  passivePhrases: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(120),
        contextQuote: z.string().trim().max(260).optional().nullable(),
        ukrainianTranslation: z.string().trim().max(240).optional().nullable(),
        cefrLevel: z.string().trim().max(10).optional().nullable(),
      }),
    )
    .max(80)
    .default([]),
  readingAloudTerms: z.array(z.string().trim().min(1).max(120)).max(120).default([]),
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

function normalizeActiveItems(raw: unknown): TranscriptAutoAppliedActiveItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TranscriptAutoAppliedActiveItem[]).map((item) => ({
    ...item,
    cefrLevel: item.cefrLevel ?? null,
    partOfSpeech: item.partOfSpeech ?? null,
    source: item.source ?? "ai_phrase",
    status: item.status ?? "approved",
  }));
}

function normalizePassiveItems(raw: unknown): TranscriptAutoAppliedPassiveItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as TranscriptAutoAppliedPassiveItem[]).map((item) => ({
    ...item,
    cefrLevel: item.cefrLevel ?? null,
    partOfSpeech: item.partOfSpeech ?? null,
    source: item.source ?? "ai_phrase",
    status: item.status ?? "approved",
  }));
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
    autoAppliedActive: normalizeActiveItems(row.auto_applied_active),
    autoAppliedPassive: normalizePassiveItems(row.auto_applied_passive),
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

function buildNameTokenExclusionSet(
  tutorName: string | null,
  studentName: string | null,
  speakers: Array<{ name: string }>,
): Set<string> {
  const excluded = new Set<string>();
  const sources = [
    tutorName,
    studentName,
    ...speakers.map((s) => s.name),
  ];

  for (const source of sources) {
    if (!source) continue;
    for (const token of extractPassiveVocabularyTermsFromText(source)) {
      if (token.length >= 2) {
        excluded.add(token);
      }
    }
  }
  return excluded;
}

function truncateQuote(text: string, maxLen = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

function extractDeterministicWordsWithQuotes(
  turns: MeetTranscriptTurn[],
  excludeNameTokens: Set<string>,
): Map<string, { rawTerm: string; quote: string }> {
  const result = new Map<string, { rawTerm: string; quote: string }>();

  for (const turn of turns) {
    const terms = extractPassiveVocabularyTermsFromText(turn.text);
    const quote = truncateQuote(turn.text);
    for (const term of terms) {
      if (term.length < 3) continue;
      if (!isEnglishWord(term)) continue;
      if (/^\d+$/.test(term)) continue;
      if (ENGLISH_STOPWORDS.has(term)) continue;
      if (excludeNameTokens.has(term)) continue;

      if (!result.has(term)) {
        result.set(term, { rawTerm: term, quote });
      }
    }
  }

  return result;
}

function getCefrSortScore(cefrLevel: string | null | undefined): number {
  if (!cefrLevel) return 2; // unscored words above A1/A2 basic
  return CEFR_PRIORITY_RANK[cefrLevel] ?? 2;
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

  // Load student context + existing vocabulary across all 3 state tables
  const [
    studentProfileRes,
    studentVocabRes,
    activeEvidenceRes,
    passiveEvidenceRes,
    wordMasteryRes,
  ] = await Promise.all([
    adminClient
      .from("profiles")
      .select("full_name, cefr_level, preferred_language")
      .eq("id", studentId)
      .maybeSingle(),
    adminClient
      .from("student_vocabulary_items")
      .select("normalized_term, item_type, current_state")
      .eq("student_id", studentId),
    adminClient
      .from("active_vocabulary_evidence")
      .select("normalized_term")
      .eq("student_id", studentId),
    adminClient
      .from("passive_vocabulary_evidence")
      .select("normalized_term")
      .eq("student_id", studentId),
    adminClient
      .from("word_mastery")
      .select("term")
      .eq("student_id", studentId),
  ]);

  const studentCefr = toValidCefrLevel(studentProfileRes.data?.cefr_level) ?? "B1";
  normalizeLearningLanguage(studentProfileRes.data?.preferred_language);

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

  for (const row of activeEvidenceRes.data ?? []) {
    existingActiveSet.add(row.normalized_term);
  }
  for (const row of passiveEvidenceRes.data ?? []) {
    existingPassiveSet.add(row.normalized_term);
  }
  for (const row of wordMasteryRes.data ?? []) {
    const norm = normalizePassiveVocabularyText(row.term);
    if (norm) existingLearningSet.add(norm);
  }

  // Step 1: Deterministic extraction from Student turns vs Tutor/Unknown turns
  const excludeNameTokens = buildNameTokenExclusionSet(
    tutorName,
    studentName ?? studentProfileRes.data?.full_name ?? null,
    parsed.speakers,
  );
  const studentTurns = parsed.turns.filter((t) => t.speakerRole === "student");
  const otherTurns = parsed.turns.filter((t) => t.speakerRole !== "student");

  const studentDetRaw = extractDeterministicWordsWithQuotes(
    studentTurns,
    excludeNameTokens,
  );
  const otherDetRaw = extractDeterministicWordsWithQuotes(
    otherTurns,
    excludeNameTokens,
  );

  // Step 2: Gemini AI pass (full transcript up to 120k chars)
  const promptTranscript = formatTranscriptForPrompt(
    parsed.turns,
    parsed.normalizedText,
  );
  const learningSample = Array.from(existingLearningSet).slice(0, 200);
  const knownActiveSample = Array.from(existingActiveSet).slice(0, 200);

  const systemInstruction = [
    "You are an expert ESL/EFL linguistics analyst for an English learning platform for Ukrainian-speaking students.",
    "Analyze the ENTIRE Google Meet lesson transcript between a Tutor and a Student.",
    "Notice that single-word vocabulary extraction is also handled deterministically, so your job focuses on HIGH-VALUE pedagogical judgment across 4 outputs:",
    "1) learningCandidates (UP TO 20 max — never pad; return 3-10 if only 3-10 are genuinely new/needed): target English words, collocations, or phrasal verbs the student explicitly asked about, stumbled over, translated into Ukrainian, couldn't recall, mispronounced/misused, or that the tutor specifically explained/assigned to practice with spaced repetition. Exclude words already in the student's Learning deck.",
    "2) activePhrases: multi-word expressions, phrasal verbs, idioms, collocations (and any words from the student's existing Learning deck listed below) that the STUDENT genuinely produced spontaneously in their own speech. NEVER include phrases that were merely read aloud from a text/article/exercise.",
    "3) passivePhrases: multi-word expressions, phrasal verbs, collocations, or key lesson vocabulary introduced/explained by the tutor or read from lesson materials.",
    "4) readingAloudTerms: single words or phrases from [STUDENT] turns that the student was ONLY reading aloud from an article, story, exercise, or screen (not spontaneous speech) — so we classify them as Passive instead of Active.",
    "Normalize verbs/nouns to base dictionary lemma (e.g., 'surround', not 'surrounded'), keep fixed phrases natural (e.g., 'stay in touch'), exclude all Ukrainian terms as English targets, and provide concise natural Ukrainian translations.",
    "Return strictly valid JSON matching the requested schema.",
  ].join(" ");

  const prompt = [
    `Lesson Date: ${lessonDate}`,
    `Lesson Title: ${lessonTitle || "1-on-1 English Lesson"}`,
    `Tutor: ${tutorName || "Tutor"}`,
    `Student: ${studentName || studentProfileRes.data?.full_name || "Student"}`,
    `Student CEFR Level: ${studentCefr}`,
    learningSample.length > 0
      ? `Student's existing Learning deck (exclude from learningCandidates; include in activePhrases if used naturally in spontaneous speech): ${learningSample.join(", ")}`
      : "",
    knownActiveSample.length > 0
      ? `Already tracked in student's Active vocabulary (skip these unless graduated from Learning): ${knownActiveSample.join(", ")}`
      : "",
    "",
    "Respond in this exact JSON format:",
    JSON.stringify(
      {
        lessonSummaryUk: "Короткий підсумок уроку українською (2-3 речення).",
        learningCandidates: [
          {
            term: "reluctant",
            partOfSpeech: "adjective",
            cefrLevel: "B2",
            ukrainianTranslation: "неохочий",
            englishDefinition: "unwilling and hesitant",
            exampleSentence: "Short natural example sentence matching the lesson",
            reasonUk: "Учень спитав значення / вагався з перекладом",
            confidence: "high",
          },
        ],
        activePhrases: [
          {
            term: "stay in touch",
            evidenceQuote: "Short spontaneous student quote",
            ukrainianTranslation: "залишатися на зв'язку",
            cefrLevel: "B1",
          },
        ],
        passivePhrases: [
          {
            term: "break the ice",
            contextQuote: "Short tutor/material quote",
            ukrainianTranslation: "розтопити лід",
            cefrLevel: "B2",
          },
        ],
        readingAloudTerms: ["perceive", "surrounded"],
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
    aiHybridAnalysisResponseSchema,
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

  // Step 3: Batch lookup Layer 2 library (lemmatization + CEFR + approval) & Layer 1 reference dictionary
  const allCandidateTermsForLookup = Array.from(
    new Set([
      ...studentDetRaw.keys(),
      ...otherDetRaw.keys(),
      ...aiResult.data.learningCandidates
        .map((c) => normalizePassiveVocabularyText(c.term))
        .filter(Boolean),
      ...aiResult.data.activePhrases
        .map((c) => normalizePassiveVocabularyText(c.term))
        .filter(Boolean),
      ...aiResult.data.passivePhrases
        .map((c) => normalizePassiveVocabularyText(c.term))
        .filter(Boolean),
      ...aiResult.data.readingAloudTerms
        .map((t) => normalizePassiveVocabularyText(t))
        .filter(Boolean),
    ]),
  ).filter((t) => t.length >= 2 && isEnglishWord(t));

  const libraryLookupInputs = allCandidateTermsForLookup.map((term) => ({
    term,
    normalizedTerm: term,
    itemType: inferPassiveVocabularyItemType(term),
  }));

  const [libraryMatchesRaw, dictMap] = await Promise.all([
    lookupPassiveVocabularyLibraryItems({
      items: libraryLookupInputs,
      adminClient,
    }),
    lookupReferenceDictionaryEntries(adminClient, allCandidateTermsForLookup),
  ]);

  const libraryByRequestedTerm = new Map<string, PassiveVocabularyLibraryResolution>();
  for (const match of libraryMatchesRaw.values()) {
    libraryByRequestedTerm.set(match.requestedNormalizedTerm, match);
  }

  // Canonicalize helper (uses Layer 2 lemma if available, else normalized term)
  const resolveCanonicalMeta = (rawTerm: string) => {
    const normalized = normalizePassiveVocabularyText(rawTerm);
    const lib = libraryByRequestedTerm.get(normalized);
    const canonicalTerm = lib ? lib.canonicalTerm : normalized;
    const canonicalNormalized = lib ? lib.canonicalNormalizedTerm : normalized;
    const dict =
      getLookupEntryForTerm(dictMap, canonicalNormalized) ??
      getLookupEntryForTerm(dictMap, normalized);

    return {
      requestedNormalized: normalized,
      canonicalTerm,
      canonicalNormalized,
      itemType: lib?.itemType ?? inferPassiveVocabularyItemType(canonicalNormalized),
      isRejected: lib?.approvalStatus === "rejected",
      cefrLevel: lib?.cefrLevel ?? null,
      partOfSpeech: lib?.partOfSpeech ?? dict?.partOfSpeech ?? null,
      ukrainianTranslation:
        (lib ? getPassiveVocabularyUkrainianTranslation(lib.attributes) : null) ??
        dict?.shortUkTranslation ??
        null,
      transcription:
        (lib ? getPassiveVocabularyTranscription(lib.attributes) : null) ??
        dict?.ipaUs ??
        dict?.ipaUk ??
        null,
      dictionaryMatched: Boolean(dict),
    };
  };

  // Reading aloud terms canonicalized
  const readingAloudMap = new Map<string, { rawTerm: string; quote: string | null }>();
  for (const term of aiResult.data.readingAloudTerms) {
    const norm = normalizePassiveVocabularyText(term);
    if (!norm || norm.length < 2) continue;
    const meta = resolveCanonicalMeta(norm);
    if (meta.isRejected) continue;
    const detQuote =
      studentDetRaw.get(norm)?.quote ??
      otherDetRaw.get(norm)?.quote ??
      null;
    if (!readingAloudMap.has(meta.canonicalNormalized)) {
      readingAloudMap.set(meta.canonicalNormalized, {
        rawTerm: meta.canonicalNormalized,
        quote: detQuote,
      });
    }
  }

  // 1) Learning candidates (capped at 20, status: "pending")
  const learningDeduped = new Map<string, TranscriptLearningCandidateItem>();
  for (const rawItem of aiResult.data.learningCandidates) {
    if (learningDeduped.size >= 20) break;
    const norm = normalizePassiveVocabularyText(rawItem.term);
    if (!norm || norm.length < 2 || !isEnglishWord(norm)) continue;
    const meta = resolveCanonicalMeta(norm);
    if (meta.isRejected) continue;
    if (existingLearningSet.has(meta.canonicalNormalized)) continue;

    if (!learningDeduped.has(meta.canonicalNormalized)) {
      learningDeduped.set(meta.canonicalNormalized, {
        term: meta.canonicalTerm,
        normalizedTerm: meta.canonicalNormalized,
        itemType: meta.itemType,
        partOfSpeech: toValidPartOfSpeech(rawItem.partOfSpeech) ?? meta.partOfSpeech ?? null,
        cefrLevel: toValidCefrLevel(rawItem.cefrLevel) ?? meta.cefrLevel ?? null,
        ukrainianTranslation:
          rawItem.ukrainianTranslation?.trim() ||
          meta.ukrainianTranslation ||
          null,
        englishDefinition: rawItem.englishDefinition?.trim() || null,
        transcription: meta.transcription,
        exampleSentence: rawItem.exampleSentence?.trim() || null,
        reasonUk:
          rawItem.reasonUk?.trim() || "Рекомендовано для повторення з уроку",
        confidence: rawItem.confidence,
        dictionaryMatched: meta.dictionaryMatched,
        alreadyInLearning: false,
        status: "pending",
      });
    }
  }

  // 2) Active candidates (AI phrases + deterministic student words; unlimited, only NEW or Graduated from Learning)
  const activeDeduped = new Map<string, TranscriptAutoAppliedActiveItem>();

  for (const aiActive of aiResult.data.activePhrases) {
    const norm = normalizePassiveVocabularyText(aiActive.term);
    if (!norm || norm.length < 2 || !isEnglishWord(norm)) continue;
    const meta = resolveCanonicalMeta(norm);
    if (meta.isRejected) continue;
    if (learningDeduped.has(meta.canonicalNormalized)) continue;
    if (readingAloudMap.has(meta.canonicalNormalized)) continue;

    const graduated = existingLearningSet.has(meta.canonicalNormalized);
    if (existingActiveSet.has(meta.canonicalNormalized) && !graduated) continue;

    if (!activeDeduped.has(meta.canonicalNormalized)) {
      activeDeduped.set(meta.canonicalNormalized, {
        term: meta.canonicalTerm,
        normalizedTerm: meta.canonicalNormalized,
        itemType: meta.itemType,
        evidenceQuote: aiActive.evidenceQuote?.trim() || null,
        ukrainianTranslation:
          aiActive.ukrainianTranslation?.trim() ||
          meta.ukrainianTranslation ||
          null,
        transcription: meta.transcription,
        cefrLevel: toValidCefrLevel(aiActive.cefrLevel) ?? meta.cefrLevel ?? null,
        partOfSpeech: meta.partOfSpeech,
        dictionaryMatched: meta.dictionaryMatched,
        graduatedFromLearning: graduated,
        source: "ai_phrase",
        status: "pending",
      });
    }
  }

  for (const [rawWord, info] of studentDetRaw.entries()) {
    const meta = resolveCanonicalMeta(rawWord);
    if (meta.isRejected) continue;
    if (learningDeduped.has(meta.canonicalNormalized)) continue;
    if (readingAloudMap.has(meta.canonicalNormalized)) continue;

    const graduated = existingLearningSet.has(meta.canonicalNormalized);
    if (existingActiveSet.has(meta.canonicalNormalized) && !graduated) continue;
    if (activeDeduped.has(meta.canonicalNormalized)) continue;

    activeDeduped.set(meta.canonicalNormalized, {
      term: meta.canonicalTerm,
      normalizedTerm: meta.canonicalNormalized,
      itemType: meta.itemType,
      evidenceQuote: info.quote,
      ukrainianTranslation: meta.ukrainianTranslation,
      transcription: meta.transcription,
      cefrLevel: meta.cefrLevel,
      partOfSpeech: meta.partOfSpeech,
      dictionaryMatched: meta.dictionaryMatched,
      graduatedFromLearning: graduated,
      source: "transcript_scan",
      status: "pending",
    });
  }

  // 3) Passive candidates (AI passive phrases + reading aloud + deterministic tutor/other words; unlimited, only NEW)
  const passiveDeduped = new Map<string, TranscriptAutoAppliedPassiveItem>();

  const shouldSkipForPassive = (canonicalNormalized: string) =>
    learningDeduped.has(canonicalNormalized) ||
    activeDeduped.has(canonicalNormalized) ||
    existingActiveSet.has(canonicalNormalized) ||
    existingPassiveSet.has(canonicalNormalized) ||
    existingLearningSet.has(canonicalNormalized);

  for (const aiPassive of aiResult.data.passivePhrases) {
    const norm = normalizePassiveVocabularyText(aiPassive.term);
    if (!norm || norm.length < 2 || !isEnglishWord(norm)) continue;
    const meta = resolveCanonicalMeta(norm);
    if (meta.isRejected || shouldSkipForPassive(meta.canonicalNormalized)) continue;

    if (!passiveDeduped.has(meta.canonicalNormalized)) {
      passiveDeduped.set(meta.canonicalNormalized, {
        term: meta.canonicalTerm,
        normalizedTerm: meta.canonicalNormalized,
        itemType: meta.itemType,
        contextQuote: aiPassive.contextQuote?.trim() || null,
        ukrainianTranslation:
          aiPassive.ukrainianTranslation?.trim() ||
          meta.ukrainianTranslation ||
          null,
        transcription: meta.transcription,
        cefrLevel: toValidCefrLevel(aiPassive.cefrLevel) ?? meta.cefrLevel ?? null,
        partOfSpeech: meta.partOfSpeech,
        dictionaryMatched: meta.dictionaryMatched,
        source: "ai_phrase",
        status: "pending",
      });
    }
  }

  for (const [canonicalNormalized, info] of readingAloudMap.entries()) {
    const meta = resolveCanonicalMeta(canonicalNormalized);
    if (meta.isRejected || shouldSkipForPassive(meta.canonicalNormalized)) continue;
    if (passiveDeduped.has(meta.canonicalNormalized)) continue;

    passiveDeduped.set(meta.canonicalNormalized, {
      term: meta.canonicalTerm,
      normalizedTerm: meta.canonicalNormalized,
      itemType: meta.itemType,
      contextQuote: info.quote,
      ukrainianTranslation: meta.ukrainianTranslation,
      transcription: meta.transcription,
      cefrLevel: meta.cefrLevel,
      partOfSpeech: meta.partOfSpeech,
      dictionaryMatched: meta.dictionaryMatched,
      source: "reading_aloud",
      status: "pending",
    });
  }

  for (const [rawWord, info] of otherDetRaw.entries()) {
    const meta = resolveCanonicalMeta(rawWord);
    if (meta.isRejected || shouldSkipForPassive(meta.canonicalNormalized)) continue;
    if (passiveDeduped.has(meta.canonicalNormalized)) continue;

    passiveDeduped.set(meta.canonicalNormalized, {
      term: meta.canonicalTerm,
      normalizedTerm: meta.canonicalNormalized,
      itemType: meta.itemType,
      contextQuote: info.quote,
      ukrainianTranslation: meta.ukrainianTranslation,
      transcription: meta.transcription,
      cefrLevel: meta.cefrLevel,
      partOfSpeech: meta.partOfSpeech,
      dictionaryMatched: meta.dictionaryMatched,
      source: "transcript_scan",
      status: "pending",
    });
  }

  const autoAppliedActive = Array.from(activeDeduped.values()).sort((a, b) => {
    if (a.graduatedFromLearning !== b.graduatedFromLearning) {
      return a.graduatedFromLearning ? -1 : 1;
    }
    if ((a.source === "ai_phrase") !== (b.source === "ai_phrase")) {
      return a.source === "ai_phrase" ? -1 : 1;
    }
    const cefrDiff = getCefrSortScore(b.cefrLevel) - getCefrSortScore(a.cefrLevel);
    if (cefrDiff !== 0) return cefrDiff;
    return a.term.localeCompare(b.term);
  });

  const autoAppliedPassive = Array.from(passiveDeduped.values()).sort((a, b) => {
    const aSpecial = a.source === "ai_phrase" || a.source === "reading_aloud";
    const bSpecial = b.source === "ai_phrase" || b.source === "reading_aloud";
    if (aSpecial !== bSpecial) return aSpecial ? -1 : 1;
    const cefrDiff = getCefrSortScore(b.cefrLevel) - getCefrSortScore(a.cefrLevel);
    if (cefrDiff !== 0) return cefrDiff;
    return a.term.localeCompare(b.term);
  });

  const learningCandidates = Array.from(learningDeduped.values());

  // Save ALL 3 categories as "pending" review — tutor controls what actually enters DB
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
        active_applied_count: 0,
        passive_applied_count: 0,
        learning_approved_count: 0,
        analyzed_at: nowIso,
        learning_reviewed_at: null,
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

export interface TranscriptReviewApplyItemInput {
  term: string;
  ukrainianTranslation?: string | null;
  englishDefinition?: string | null;
  partOfSpeech?: string | null;
  cefrLevel?: string | null;
  quote?: string | null;
  source?: string | null;
  graduatedFromLearning?: boolean;
}

export async function applyLessonTranscriptVocabulary({
  lessonId,
  tutorId,
  activeItems = [],
  passiveItems = [],
  learningItems = [],
  adminClient,
}: {
  lessonId: string;
  tutorId: string;
  activeItems?: TranscriptReviewApplyItemInput[];
  passiveItems?: TranscriptReviewApplyItemInput[];
  learningItems?: TranscriptReviewApplyItemInput[];
  adminClient: SupabaseAdminClient;
}): Promise<{
  transcript: LessonMeetTranscriptView;
  activeAppliedCount: number;
  passiveAppliedCount: number;
  addedCount: number;
  skippedExistingCount: number;
}> {
  const [{ data: transcriptRow, error: fetchError }, { data: lessonRow }] =
    await Promise.all([
      adminClient
        .from("lesson_meet_transcripts")
        .select("*")
        .eq("lesson_id", lessonId)
        .maybeSingle(),
      adminClient
        .from("tutor_student_lessons")
        .select("id, title, lesson_date")
        .eq("id", lessonId)
        .maybeSingle(),
    ]);

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
  const nowIso = new Date().toISOString();
  const lessonDate = lessonRow?.lesson_date ?? nowIso.slice(0, 10);
  const sourceLabel = `Meet Lesson · ${lessonDate}${lessonRow?.title ? ` · ${lessonRow.title}` : ""}`;

  // Deduplicate inputs cleanly across the 3 final buckets (Learning > Active > Passive)
  const dedupeInputs = (list: TranscriptReviewApplyItemInput[]) => {
    const map = new Map<
      string,
      TranscriptReviewApplyItemInput & {
        normalizedTerm: string;
        itemType: "word" | "phrase";
      }
    >();
    for (const item of list) {
      const normalized = normalizePassiveVocabularyText(item.term);
      if (!normalized || normalized.length < 2) continue;
      map.set(normalized, {
        ...item,
        term: normalized,
        normalizedTerm: normalized,
        itemType: inferPassiveVocabularyItemType(normalized),
        ukrainianTranslation: item.ukrainianTranslation?.trim() || null,
        englishDefinition: item.englishDefinition?.trim() || null,
      });
    }
    return map;
  };

  const finalLearningMap = dedupeInputs(learningItems);
  const finalActiveMap = dedupeInputs(activeItems);
  for (const key of finalLearningMap.keys()) {
    finalActiveMap.delete(key);
  }
  const finalPassiveMap = dedupeInputs(passiveItems);
  for (const key of finalLearningMap.keys()) {
    finalPassiveMap.delete(key);
  }
  for (const key of finalActiveMap.keys()) {
    finalPassiveMap.delete(key);
  }

  const finalActiveList = Array.from(finalActiveMap.values());
  const finalPassiveList = Array.from(finalPassiveMap.values());
  const finalLearningList = Array.from(finalLearningMap.values());

  // 1) Apply approved Active vocabulary
  if (finalActiveList.length > 0) {
    await upsertActiveVocabularyEvidence({
      adminClient,
      studentId,
      actorUserId: tutorId,
      targetLanguage,
      terms: finalActiveList.map((item) => item.term),
      sourceType: "lesson_recording",
      sourceLabel,
      usedAt: new Date(`${lessonDate}T12:00:00Z`).toISOString(),
    });
  }

  // 2) Apply approved Passive vocabulary
  if (finalPassiveList.length > 0) {
    const passiveResolutions = await resolvePassiveVocabularyLibraryItems({
      adminClient,
      actorUserId: tutorId,
      targetLanguage,
      items: finalPassiveList.map((item) => ({
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        partOfSpeech: toValidPartOfSpeech(item.partOfSpeech),
        ukrainianTranslation: item.ukrainianTranslation,
      })),
    });

    const acceptedPassive = passiveResolutions.filter(
      (res) => res.approvalStatus !== "rejected",
    );

    if (acceptedPassive.length > 0) {
      const canonicalPassiveMap = new Map<
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
        if (canonicalPassiveMap.has(key)) continue;

        const input = finalPassiveMap.get(resolution.requestedNormalizedTerm);
        const definition =
          input?.ukrainianTranslation ||
          getPassiveVocabularyUkrainianTranslation(resolution.attributes) ||
          getPassiveVocabularyEnglishDefinitions(resolution.attributes)[0] ||
          null;

        canonicalPassiveMap.set(key, {
          term: resolution.canonicalTerm,
          normalizedTerm: resolution.canonicalNormalizedTerm,
          itemType: resolution.itemType,
          libraryItemId: resolution.libraryItemId,
          definition,
        });
      }

      const canonicalPassiveList = Array.from(canonicalPassiveMap.values());
      const { data: existingPassiveRows } = await adminClient
        .from("passive_vocabulary_evidence")
        .select(
          "normalized_term, item_type, definition, source_label, import_count, library_item_id",
        )
        .eq("student_id", studentId)
        .in(
          "normalized_term",
          canonicalPassiveList.map((item) => item.normalizedTerm),
        );

      const existingPassiveMap = new Map(
        (existingPassiveRows ?? []).map((row) => [
          getPassiveVocabularyCompositeKey(row.normalized_term, row.item_type),
          row,
        ]),
      );

      const upsertPassiveRows = canonicalPassiveList.map((item) => {
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
        throw new Error("Failed to save approved Passive vocabulary.");
      }

      await syncStudentVocabularyStateFromPassiveEvidence({
        adminClient,
        studentId,
        items: canonicalPassiveList.map((item) => ({
          term: item.term,
          normalizedTerm: item.normalizedTerm,
          itemType: item.itemType,
          libraryItemId: item.libraryItemId,
        })),
      });
    }
  }

  // 3) Apply approved Learning vocabulary into word_mastery (SRS) + student_vocabulary_items
  let addedCount = 0;
  let skippedExistingCount = 0;

  if (finalLearningList.length > 0) {
    const resolutions = await resolvePassiveVocabularyLibraryItems({
      adminClient,
      actorUserId: tutorId,
      targetLanguage,
      items: finalLearningList.map((item) => ({
        term: item.term,
        normalizedTerm: item.normalizedTerm,
        itemType: item.itemType,
        partOfSpeech: toValidPartOfSpeech(item.partOfSpeech),
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
        .select("id, term, definition, source_lesson_id")
        .eq("student_id", studentId)
        .in("term", canonicalTerms);

    if (existingMasteryError) {
      throw new Error("Failed to check existing student vocabulary.");
    }

    const existingMasteryMap = new Map(
      (existingMasteryRows ?? []).map((row) => [row.term.toLowerCase(), row]),
    );

    const rowsToInsert: Array<{
      student_id: string;
      term: string;
      definition: string;
      mastery_level: number;
      next_review: string;
      source_lesson_id: string;
    }> = [];

    for (const resolution of resolutions) {
      const input = finalLearningMap.get(resolution.requestedNormalizedTerm);
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
        const updates: { definition?: string; source_lesson_id?: string } = {};
        if (!(existing.definition ?? "").trim() && definition.trim()) {
          updates.definition = definition;
        }
        if (!existing.source_lesson_id) {
          updates.source_lesson_id = lessonId;
        }
        if (Object.keys(updates).length > 0) {
          await adminClient
            .from("word_mastery")
            .update(updates)
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
          source_lesson_id: lessonId,
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

  // Reconcile stored JSONB audit snapshots with the tutor's exact reviewed choices (including moves & manual additions)
  const prevActive = normalizeActiveItems(transcriptRow.auto_applied_active);
  const prevPassive = normalizePassiveItems(transcriptRow.auto_applied_passive);
  const prevLearning = Array.isArray(transcriptRow.learning_candidates)
    ? (transcriptRow.learning_candidates as unknown as TranscriptLearningCandidateItem[])
    : [];

  const prevActiveByTerm = new Map(prevActive.map((i) => [i.normalizedTerm, i]));
  const prevPassiveByTerm = new Map(prevPassive.map((i) => [i.normalizedTerm, i]));
  const prevLearningByTerm = new Map(prevLearning.map((i) => [i.normalizedTerm, i]));

  const nextActiveList: TranscriptAutoAppliedActiveItem[] = [];
  for (const input of finalActiveList) {
    const oldA = prevActiveByTerm.get(input.normalizedTerm);
    const oldP = prevPassiveByTerm.get(input.normalizedTerm);
    const oldL = prevLearningByTerm.get(input.normalizedTerm);
    nextActiveList.push({
      term: input.term,
      normalizedTerm: input.normalizedTerm,
      itemType: input.itemType,
      evidenceQuote:
        input.quote ??
        oldA?.evidenceQuote ??
        oldP?.contextQuote ??
        oldL?.exampleSentence ??
        null,
      ukrainianTranslation:
        input.ukrainianTranslation ??
        oldA?.ukrainianTranslation ??
        oldP?.ukrainianTranslation ??
        oldL?.ukrainianTranslation ??
        null,
      transcription:
        oldA?.transcription ?? oldP?.transcription ?? oldL?.transcription ?? null,
      cefrLevel: input.cefrLevel ?? oldA?.cefrLevel ?? oldP?.cefrLevel ?? oldL?.cefrLevel ?? null,
      partOfSpeech:
        input.partOfSpeech ?? oldA?.partOfSpeech ?? oldP?.partOfSpeech ?? oldL?.partOfSpeech ?? null,
      dictionaryMatched:
        oldA?.dictionaryMatched ?? oldP?.dictionaryMatched ?? oldL?.dictionaryMatched ?? false,
      graduatedFromLearning:
        input.graduatedFromLearning ?? oldA?.graduatedFromLearning ?? false,
      source:
        oldA?.source ?? (input.source === "manual" ? "manual" : "ai_phrase"),
      status: "approved",
    });
  }
  for (const oldItem of prevActive) {
    if (
      !finalActiveMap.has(oldItem.normalizedTerm) &&
      !finalPassiveMap.has(oldItem.normalizedTerm) &&
      !finalLearningMap.has(oldItem.normalizedTerm)
    ) {
      nextActiveList.push({ ...oldItem, status: "dismissed" });
    }
  }

  const nextPassiveList: TranscriptAutoAppliedPassiveItem[] = [];
  for (const input of finalPassiveList) {
    const oldP = prevPassiveByTerm.get(input.normalizedTerm);
    const oldA = prevActiveByTerm.get(input.normalizedTerm);
    const oldL = prevLearningByTerm.get(input.normalizedTerm);
    nextPassiveList.push({
      term: input.term,
      normalizedTerm: input.normalizedTerm,
      itemType: input.itemType,
      contextQuote:
        input.quote ??
        oldP?.contextQuote ??
        oldA?.evidenceQuote ??
        oldL?.exampleSentence ??
        null,
      ukrainianTranslation:
        input.ukrainianTranslation ??
        oldP?.ukrainianTranslation ??
        oldA?.ukrainianTranslation ??
        oldL?.ukrainianTranslation ??
        null,
      transcription:
        oldP?.transcription ?? oldA?.transcription ?? oldL?.transcription ?? null,
      cefrLevel: input.cefrLevel ?? oldP?.cefrLevel ?? oldA?.cefrLevel ?? oldL?.cefrLevel ?? null,
      partOfSpeech:
        input.partOfSpeech ?? oldP?.partOfSpeech ?? oldA?.partOfSpeech ?? oldL?.partOfSpeech ?? null,
      dictionaryMatched:
        oldP?.dictionaryMatched ?? oldA?.dictionaryMatched ?? oldL?.dictionaryMatched ?? false,
      source:
        oldP?.source ?? (input.source === "manual" ? "manual" : "ai_phrase"),
      status: "approved",
    });
  }
  for (const oldItem of prevPassive) {
    if (
      !finalActiveMap.has(oldItem.normalizedTerm) &&
      !finalPassiveMap.has(oldItem.normalizedTerm) &&
      !finalLearningMap.has(oldItem.normalizedTerm)
    ) {
      nextPassiveList.push({ ...oldItem, status: "dismissed" });
    }
  }

  const nextLearningList: TranscriptLearningCandidateItem[] = [];
  for (const input of finalLearningList) {
    const oldL = prevLearningByTerm.get(input.normalizedTerm);
    const oldA = prevActiveByTerm.get(input.normalizedTerm);
    const oldP = prevPassiveByTerm.get(input.normalizedTerm);
    nextLearningList.push({
      term: input.term,
      normalizedTerm: input.normalizedTerm,
      itemType: input.itemType,
      partOfSpeech:
        input.partOfSpeech ?? oldL?.partOfSpeech ?? oldA?.partOfSpeech ?? oldP?.partOfSpeech ?? null,
      cefrLevel:
        input.cefrLevel ?? oldL?.cefrLevel ?? oldA?.cefrLevel ?? oldP?.cefrLevel ?? null,
      ukrainianTranslation:
        input.ukrainianTranslation ??
        oldL?.ukrainianTranslation ??
        oldA?.ukrainianTranslation ??
        oldP?.ukrainianTranslation ??
        null,
      englishDefinition:
        input.englishDefinition ?? oldL?.englishDefinition ?? null,
      transcription:
        oldL?.transcription ?? oldA?.transcription ?? oldP?.transcription ?? null,
      exampleSentence:
        oldL?.exampleSentence ?? input.quote ?? oldA?.evidenceQuote ?? oldP?.contextQuote ?? null,
      reasonUk:
        oldL?.reasonUk ??
        (input.source === "manual"
          ? "Додано викладачем вручну"
          : "Перенесено викладачем у Learning"),
      confidence: oldL?.confidence ?? "high",
      dictionaryMatched:
        oldL?.dictionaryMatched ?? oldA?.dictionaryMatched ?? oldP?.dictionaryMatched ?? false,
      alreadyInLearning: false,
      status: "approved",
    });
  }
  for (const oldItem of prevLearning) {
    if (
      !finalActiveMap.has(oldItem.normalizedTerm) &&
      !finalPassiveMap.has(oldItem.normalizedTerm) &&
      !finalLearningMap.has(oldItem.normalizedTerm)
    ) {
      nextLearningList.push({
        ...oldItem,
        status: oldItem.status === "approved" ? "approved" : "dismissed",
      });
    }
  }

  const activeApprovedTotal = nextActiveList.filter(
    (c) => c.status === "approved",
  ).length;
  const passiveApprovedTotal = nextPassiveList.filter(
    (c) => c.status === "approved",
  ).length;
  const learningApprovedTotal = nextLearningList.filter(
    (c) => c.status === "approved",
  ).length;

  const { data: updatedRow, error: updateError } = await adminClient
    .from("lesson_meet_transcripts")
    .update({
      auto_applied_active: nextActiveList as unknown as Json,
      auto_applied_passive: nextPassiveList as unknown as Json,
      learning_candidates: nextLearningList as unknown as Json,
      active_applied_count: activeApprovedTotal,
      passive_applied_count: passiveApprovedTotal,
      learning_approved_count: learningApprovedTotal,
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
    activeAppliedCount: activeApprovedTotal,
    passiveAppliedCount: passiveApprovedTotal,
    addedCount,
    skippedExistingCount,
  };
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
}) {
  return applyLessonTranscriptVocabulary({
    lessonId,
    tutorId,
    learningItems: approvedItems,
    adminClient,
  });
}
