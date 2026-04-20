import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  getPassiveVocabularyUkrainianTranslation,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  withPassiveVocabularyUkrainianTranslation,
} from "@/lib/mastery/passive-vocabulary";
import { createClient } from "@/lib/supabase/server";

const passiveVocabularyTranslationSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalizedValue = value.trim().replace(/\s+/g, " ");
    return normalizedValue.length > 0 ? normalizedValue : null;
  },
  z.string().max(200).nullable().optional(),
);

const updatePassiveLibraryItemSchema = z.object({
  canonicalTerm: z.string().trim().min(1).max(200),
  cefrLevel: z.enum(PASSIVE_VOCABULARY_CEFR_LEVELS).nullable().optional(),
  partOfSpeech: z.enum(PASSIVE_VOCABULARY_PARTS_OF_SPEECH).nullable().optional(),
  ukrainianTranslation: passiveVocabularyTranslationSchema,
  attributes: z.record(z.unknown()).optional(),
});

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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

  const { data: existingItem, error: existingItemError } = await access.adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes",
    )
    .eq("id", id)
    .maybeSingle();

  if (existingItemError) {
    return NextResponse.json(
      { error: "Failed to load passive vocabulary library item" },
      { status: 500 },
    );
  }

  if (!existingItem) {
    return NextResponse.json(
      { error: "Passive vocabulary library item not found" },
      { status: 404 },
    );
  }

  const canonicalTerm = parsed.data.canonicalTerm.trim().replace(/\s+/g, " ");
  const normalizedTerm = normalizePassiveVocabularyText(canonicalTerm);
  const nowIso = new Date().toISOString();
  const existingAttributes = normalizePassiveVocabularyLibraryAttributes(
    existingItem.attributes,
  );
  const nextAttributes = withPassiveVocabularyUkrainianTranslation(
    parsed.data.attributes === undefined
      ? existingAttributes
      : normalizePassiveVocabularyLibraryAttributes(parsed.data.attributes),
    parsed.data.ukrainianTranslation === undefined
      ? getPassiveVocabularyUkrainianTranslation(existingAttributes)
      : parsed.data.ukrainianTranslation,
  );
  const nextCefrLevel =
    existingItem.item_type === "phrase"
      ? null
      : parsed.data.cefrLevel ?? existingItem.cefr_level;
  const nextPartOfSpeech =
    existingItem.item_type === "phrase"
      ? "phrase"
      : parsed.data.partOfSpeech ?? existingItem.part_of_speech;

  const { data: updatedItem, error: updateError } = await access.adminClient
    .from("passive_vocabulary_library")
    .update({
      canonical_term: canonicalTerm,
      normalized_term: normalizedTerm,
      cefr_level: nextCefrLevel,
      part_of_speech: nextPartOfSpeech,
      attributes: nextAttributes,
      enrichment_status:
        existingItem.item_type === "phrase" || (nextCefrLevel && nextPartOfSpeech)
          ? "completed"
          : "failed",
      enrichment_error:
        existingItem.item_type === "phrase" || (nextCefrLevel && nextPartOfSpeech)
          ? null
          : "Metadata still needs a CEFR level and part of speech.",
      updated_by: access.userId,
      updated_at: nowIso,
    })
    .eq("id", id)
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, created_by, updated_by, created_at, updated_at",
    )
    .single();

  if (updateError) {
    return NextResponse.json(
      {
        error:
          updateError.code === "23505"
            ? "Another library item already uses that canonical term"
            : "Failed to update passive vocabulary library item",
      },
      { status: 500 },
    );
  }

  if (existingItem.normalized_term !== normalizedTerm) {
    const { error: aliasError } = await access.adminClient
      .from("passive_vocabulary_library_forms")
      .insert({
        library_item_id: id,
        form_term: existingItem.canonical_term,
        normalized_form: existingItem.normalized_term,
        item_type: existingItem.item_type,
        is_canonical: false,
        updated_at: nowIso,
      });

    if (aliasError && aliasError.code !== "23505") {
      return NextResponse.json(
        { error: "Failed to preserve the previous canonical form alias" },
        { status: 500 },
      );
    }
  }

  await access.adminClient
    .from("passive_vocabulary_library_forms")
    .delete()
    .eq("library_item_id", id)
    .eq("normalized_form", normalizedTerm)
    .eq("item_type", existingItem.item_type)
    .eq("is_canonical", false);

  const { error: canonicalFormUpdateError } = await access.adminClient
    .from("passive_vocabulary_library_forms")
    .update({
      form_term: canonicalTerm,
      normalized_form: normalizedTerm,
      updated_at: nowIso,
    })
    .eq("library_item_id", id)
    .eq("is_canonical", true);

  if (canonicalFormUpdateError) {
    return NextResponse.json(
      { error: "Failed to update the canonical library form" },
      { status: 500 },
    );
  }

  const { data: canonicalRows, error: canonicalRowsError } = await access.adminClient
    .from("passive_vocabulary_library_forms")
    .select("id")
    .eq("library_item_id", id)
    .eq("is_canonical", true)
    .eq("normalized_form", normalizedTerm);

  if (canonicalRowsError) {
    return NextResponse.json(
      { error: "Failed to verify the canonical library form" },
      { status: 500 },
    );
  }

  if ((canonicalRows ?? []).length === 0) {
    const { error: canonicalFormInsertError } = await access.adminClient
      .from("passive_vocabulary_library_forms")
      .insert({
        library_item_id: id,
        form_term: canonicalTerm,
        normalized_form: normalizedTerm,
        item_type: existingItem.item_type,
        is_canonical: true,
        updated_at: nowIso,
      });

    if (canonicalFormInsertError) {
      return NextResponse.json(
        { error: "Failed to save the canonical library form" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ item: updatedItem });
}