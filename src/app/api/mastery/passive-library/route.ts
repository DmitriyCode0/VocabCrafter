import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PASSIVE_VOCABULARY_CEFR_LEVELS,
  PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  getPassiveVocabularyCompositeKey,
  inferPassiveVocabularyItemType,
  normalizePassiveVocabularyLibraryAttributes,
  normalizePassiveVocabularyText,
  passiveVocabularyLibraryImportSchema,
  type PassiveVocabularyItemType,
} from "@/lib/mastery/passive-vocabulary";
import type { PassiveVocabularyLibraryAdminItem } from "@/lib/mastery/passive-vocabulary-library";
import { importPassiveVocabularyLibraryItems as importPassiveVocabularyLibraryBatch } from "@/lib/mastery/passive-vocabulary-library";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

async function getCurrentLibraryAccess() {
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

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    userId: user.id,
    role: profile.role,
    adminClient: createAdminClient(),
  };
}

async function requireSuperadmin() {
  const access = await getCurrentLibraryAccess();

  if ("errorResponse" in access) {
    return {
      errorResponse: access.errorResponse,
    };
  }

  if (access.role !== "superadmin") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { userId: access.userId, adminClient: access.adminClient };
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function toAdminItem(row: {
  id: string;
  canonical_term: string;
  normalized_term: string;
  item_type: string;
  cefr_level: string | null;
  part_of_speech: string | null;
  attributes: unknown;
  enrichment_status: string;
  enrichment_error: string | null;
  updated_at: string;
}): PassiveVocabularyLibraryAdminItem {
  return {
    id: row.id,
    canonical_term: row.canonical_term,
    normalized_term: row.normalized_term,
    item_type: row.item_type as PassiveVocabularyItemType,
    cefr_level: row.cefr_level as PassiveVocabularyLibraryAdminItem["cefr_level"],
    part_of_speech:
      row.part_of_speech as PassiveVocabularyLibraryAdminItem["part_of_speech"],
    attributes: normalizePassiveVocabularyLibraryAttributes(row.attributes),
    enrichment_status:
      row.enrichment_status as PassiveVocabularyLibraryAdminItem["enrichment_status"],
    enrichment_error: row.enrichment_error,
    updated_at: row.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const access = await getCurrentLibraryAccess();
  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  if (access.role !== "tutor" && access.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const offset = parsePositiveInt(searchParams.get("offset"), 0);
  const requestedLimit = parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT);
  const limit = Math.min(Math.max(requestedLimit || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const cefrFilter = searchParams.get("cefr")?.trim() ?? "all";
  const posFilter = searchParams.get("pos")?.trim();

  let query = access.adminClient
    .from("passive_vocabulary_library")
    .select(
      "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, enrichment_status, enrichment_error, updated_at",
    )
    .order("updated_at", { ascending: false });

  if (searchQuery) {
    query = query.ilike("canonical_term", `%${searchQuery}%`);
  }

  if (cefrFilter === "unknown") {
    query = query.is("cefr_level", null);
  } else if (PASSIVE_VOCABULARY_CEFR_LEVELS.includes(cefrFilter as never)) {
    query = query.eq("cefr_level", cefrFilter);
  }

  if (posFilter) {
    const posValues = posFilter.split(",");
    query = query.in("part_of_speech", posValues);
  }

  const { data, error } = await query.range(offset, offset + limit);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load passive vocabulary library items" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    items: (data ?? []).slice(0, limit).map(toAdminItem),
    hasMore: (data ?? []).length > limit,
    availableCefrLevels: PASSIVE_VOCABULARY_CEFR_LEVELS,
    availablePartsOfSpeech: PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
  });
}

export async function POST(request: NextRequest) {
  const access = await requireSuperadmin();
  if ("errorResponse" in access) {
    return access.errorResponse;
  }

  const body = await request.json().catch(() => null);
  const parsed = passiveVocabularyLibraryImportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dedupedItems = new Map<
    string,
    {
      term: string;
      normalizedTerm: string;
      itemType: PassiveVocabularyItemType;
    }
  >();

  for (const rawItem of parsed.data.items) {
    const trimmedTerm = rawItem.term.trim().replace(/\s+/g, " ");
    const normalizedTerm = normalizePassiveVocabularyText(trimmedTerm);

    if (!normalizedTerm) {
      continue;
    }

    const itemType =
      rawItem.itemType === "phrase" || inferPassiveVocabularyItemType(trimmedTerm) === "phrase"
        ? "phrase"
        : "word";
    const key = getPassiveVocabularyCompositeKey(normalizedTerm, itemType);

    dedupedItems.set(key, {
      term: trimmedTerm,
      normalizedTerm,
      itemType,
    });
  }

  const items = Array.from(dedupedItems.values());
  if (items.length === 0) {
    return NextResponse.json(
      { error: "No valid library items provided" },
      { status: 400 },
    );
  }

  try {
    const result = await importPassiveVocabularyLibraryBatch({
      items,
      targetLanguage: parsed.data.targetLanguage,
      actorUserId: access.userId,
      adminClient: access.adminClient,
    });

    return NextResponse.json({
      processedCount: items.length,
      importedCount: result.importedCount,
      createdCount: result.createdCount,
      existingCount: result.existingCount,
      targetLanguage: parsed.data.targetLanguage,
      sourceLabel: parsed.data.sourceLabel ?? null,
    });
  } catch (error) {
    console.error("Passive vocabulary library import error:", error);
    return NextResponse.json(
      { error: "Failed to import passive vocabulary library items" },
      { status: 500 },
    );
  }
}