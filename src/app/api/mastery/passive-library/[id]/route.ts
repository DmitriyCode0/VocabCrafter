import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_NOUN_COUNTABILITY,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  PASSIVE_VOCABULARY_VERB_PATTERN,
  PASSIVE_VOCABULARY_VERB_REGULARITY,
  PASSIVE_VOCABULARY_VERB_STATE,
  normalizePassiveVocabularyLibraryAttributes,
} from "@/lib/mastery/passive-vocabulary";
import { updatePassiveVocabularyLibraryItem } from "@/lib/mastery/passive-vocabulary-library-updates";
import { createClient } from "@/lib/supabase/server";

const passiveVocabularyTranslationSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
}, z.string().max(200).nullable().optional());

const passiveVocabularyOptionalTextSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
}, z.string().max(200).nullable().optional());

const updatePassiveLibraryItemSchema = z.object({
  canonicalTerm: z.string().trim().min(1).max(200),
  cefrLevel: z.enum(PASSIVE_VOCABULARY_CEFR_LEVELS).nullable().optional(),
  partOfSpeech: z
    .enum(PASSIVE_VOCABULARY_PARTS_OF_SPEECH)
    .nullable()
    .optional(),
  ukrainianTranslation: passiveVocabularyTranslationSchema,
  englishDefinitions: z
    .array(z.string().trim().min(1).max(400))
    .max(5)
    .optional(),
  americanTranscription: passiveVocabularyOptionalTextSchema,
  britishTranscription: passiveVocabularyOptionalTextSchema,
  transcription: passiveVocabularyOptionalTextSchema,
  nounCountability: z
    .array(z.enum(PASSIVE_VOCABULARY_NOUN_COUNTABILITY))
    .max(2)
    .optional(),
  verbPattern: z
    .array(z.enum(PASSIVE_VOCABULARY_VERB_PATTERN))
    .max(2)
    .optional(),
  verbRegularity: z
    .array(z.enum(PASSIVE_VOCABULARY_VERB_REGULARITY))
    .max(2)
    .optional(),
  verbState: z.array(z.enum(PASSIVE_VOCABULARY_VERB_STATE)).max(2).optional(),
  forms: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "superadmin") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId: user.id, adminClient: createAdminClient() };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireSuperadmin();
  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updatePassiveLibraryItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updatedItem = await updatePassiveVocabularyLibraryItem({
      adminClient: access.adminClient,
      libraryItemId: id,
      updatedBy: access.userId,
      canonicalTerm: parsed.data.canonicalTerm,
      cefrLevel: parsed.data.cefrLevel ?? null,
      partOfSpeech: parsed.data.partOfSpeech ?? null,
      ukrainianTranslation: parsed.data.ukrainianTranslation,
      englishDefinitions: parsed.data.englishDefinitions,
      americanTranscription: parsed.data.americanTranscription,
      britishTranscription: parsed.data.britishTranscription,
      transcription: parsed.data.transcription,
      nounCountability: parsed.data.nounCountability,
      verbPattern: parsed.data.verbPattern,
      verbRegularity: parsed.data.verbRegularity,
      verbState: parsed.data.verbState,
      forms: parsed.data.forms,
      attributes: normalizePassiveVocabularyLibraryAttributes(
        parsed.data.attributes,
      ),
    });

    return NextResponse.json({ item: updatedItem });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update passive vocabulary library item";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Passive vocabulary library item not found" ? 404 : 500,
      },
    );
  }
}
