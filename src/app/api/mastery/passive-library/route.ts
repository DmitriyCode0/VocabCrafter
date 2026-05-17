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
import { isEnglishWord } from "@/lib/text/language-detection";
import type { PassiveVocabularyLibraryAdminItem } from "@/lib/mastery/passive-vocabulary-library";
import { importPassiveVocabularyLibraryItems as importPassiveVocabularyLibraryBatch } from "@/lib/mastery/passive-vocabulary-library";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const APPROVAL_FACET_VALUES = [
  "all",
  "unconfirmed",
  "confirmed",
  "rejected",
] as const;

async function getCurrentLibraryAccess() {
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

const LIBRARY_ITEM_SELECT_FIELDS =
  "id, canonical_term, normalized_term, item_type, cefr_level, part_of_speech, attributes, approval_status, rejection_reason, enrichment_status, enrichment_error, reviewed_at, updated_at";
const LIBRARY_FACET_SELECT_FIELDS =
  "id, cefr_level, part_of_speech, approval_status, updated_at";

type LibraryApprovalFacetValue = (typeof APPROVAL_FACET_VALUES)[number];
type LibraryCefrFacetValue =
  | "all"
  | "unknown"
  | (typeof PASSIVE_VOCABULARY_CEFR_LEVELS)[number];
type PassiveVocabularyLibrarySortableRow = Pick<
  PassiveVocabularyLibraryAdminItemRow,
  "id" | "canonical_term" | "normalized_term" | "item_type"
>;

interface PassiveLibraryFacetRow {
  id: string;
  cefr_level: string | null;
  part_of_speech: string | null;
  approval_status: PassiveVocabularyLibraryAdminItem["approval_status"];
  updated_at: string;
}

interface PassiveLibraryFacetCounts {
  cefr: Record<LibraryCefrFacetValue, number>;
  approval: Record<LibraryApprovalFacetValue, number>;
  partOfSpeech: Record<
    (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number],
    number
  >;
}

function createEmptyFacetCounts(): PassiveLibraryFacetCounts {
  return {
    cefr: {
      all: 0,
      unknown: 0,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    },
    approval: Object.fromEntries(
      APPROVAL_FACET_VALUES.map((value) => [value, 0]),
    ) as PassiveLibraryFacetCounts["approval"],
    partOfSpeech: Object.fromEntries(
      PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map((value) => [value, 0]),
    ) as PassiveLibraryFacetCounts["partOfSpeech"],
  };
}

function getCefrFacetValue(cefrLevel: string | null): LibraryCefrFacetValue {
  if (!cefrLevel) {
    return "unknown";
  }

  return PASSIVE_VOCABULARY_CEFR_LEVELS.includes(cefrLevel as never)
    ? (cefrLevel as LibraryCefrFacetValue)
    : "unknown";
}

function buildFacetCountsFromRows(input: {
  cefrRows: PassiveLibraryFacetRow[];
  approvalRows: PassiveLibraryFacetRow[];
  posRows: PassiveLibraryFacetRow[];
}): PassiveLibraryFacetCounts {
  const counts = createEmptyFacetCounts();

  counts.cefr.all = input.cefrRows.length;
  for (const row of input.cefrRows) {
    counts.cefr[getCefrFacetValue(row.cefr_level)] += 1;
  }

  counts.approval.all = input.approvalRows.length;
  for (const row of input.approvalRows) {
    counts.approval[row.approval_status] += 1;
  }

  for (const row of input.posRows) {
    if (
      PASSIVE_VOCABULARY_PARTS_OF_SPEECH.includes(row.part_of_speech as never)
    ) {
      counts.partOfSpeech[
        row.part_of_speech as (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number]
      ] += 1;
    }
  }

  return counts;
}

function asRowArray<TRow>(value: unknown): TRow[] {
  return Array.isArray(value) ? (value as TRow[]) : [];
}

function toAdminItem(row: {
  id: string;
  canonical_term: string;
  normalized_term: string;
  item_type: string;
  cefr_level: string | null;
  part_of_speech: string | null;
  attributes: unknown;
  approval_status: "unconfirmed" | "confirmed" | "rejected";
  rejection_reason: string | null;
  enrichment_status: string;
  enrichment_error: string | null;
  reviewed_at: string | null;
  updated_at: string;
}): PassiveVocabularyLibraryAdminItem {
  return {
    id: row.id,
    canonical_term: row.canonical_term,
    normalized_term: row.normalized_term,
    item_type: row.item_type as PassiveVocabularyItemType,
    cefr_level:
      row.cefr_level as PassiveVocabularyLibraryAdminItem["cefr_level"],
    part_of_speech:
      row.part_of_speech as PassiveVocabularyLibraryAdminItem["part_of_speech"],
    attributes: normalizePassiveVocabularyLibraryAttributes(row.attributes),
    approval_status: row.approval_status,
    rejection_reason: row.rejection_reason,
    enrichment_status:
      row.enrichment_status as PassiveVocabularyLibraryAdminItem["enrichment_status"],
    enrichment_error: row.enrichment_error,
    reviewed_at: row.reviewed_at,
    updated_at: row.updated_at,
  };
}

type PassiveVocabularyLibraryAdminItemRow = Parameters<typeof toAdminItem>[0];

function compareLibraryRowsAlphabetically(
  left: PassiveVocabularyLibrarySortableRow,
  right: PassiveVocabularyLibrarySortableRow,
) {
  const normalizedTermComparison = left.normalized_term.localeCompare(
    right.normalized_term,
    undefined,
    { numeric: true, sensitivity: "base" },
  );

  if (normalizedTermComparison !== 0) {
    return normalizedTermComparison;
  }

  const canonicalTermComparison = left.canonical_term.localeCompare(
    right.canonical_term,
    undefined,
    { numeric: true, sensitivity: "base" },
  );

  if (canonicalTermComparison !== 0) {
    return canonicalTermComparison;
  }

  const itemTypeComparison = left.item_type.localeCompare(
    right.item_type,
    undefined,
    { numeric: true, sensitivity: "base" },
  );

  if (itemTypeComparison !== 0) {
    return itemTypeComparison;
  }

  return left.id.localeCompare(right.id);
}

interface QueryFilterOptions {
  includeCefrFilter?: boolean;
  includeApprovalFilter?: boolean;
  includePosFilter?: boolean;
  selectFields?: string;
  orderAlphabetically?: boolean;
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
  const requestedLimit = parsePositiveInt(
    searchParams.get("limit"),
    DEFAULT_LIMIT,
  );
  const limit = Math.min(
    Math.max(requestedLimit || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const cefrFilter = searchParams.get("cefr")?.trim() ?? "all";
  const posFilter = searchParams.get("pos")?.trim();
  const approvalFilter = searchParams.get("status")?.trim() ?? "all";
  const normalizedPosFilters = (posFilter ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(
      (value): value is (typeof PASSIVE_VOCABULARY_PARTS_OF_SPEECH)[number] =>
        PASSIVE_VOCABULARY_PARTS_OF_SPEECH.includes(value as never),
    );

  const createLibraryItemsQuery = ({
    includeCefrFilter = true,
    includeApprovalFilter = true,
    includePosFilter = true,
    selectFields = LIBRARY_ITEM_SELECT_FIELDS,
    orderAlphabetically = false,
  }: QueryFilterOptions = {}) => {
    let query = access.adminClient
      .from("passive_vocabulary_library")
      .select(selectFields);

    if (orderAlphabetically) {
      query = query
        .order("normalized_term", { ascending: true })
        .order("canonical_term", { ascending: true })
        .order("item_type", { ascending: true })
        .order("id", { ascending: true });
    }

    if (access.role !== "superadmin") {
      query = query.eq("approval_status", "confirmed");
    } else if (
      includeApprovalFilter &&
      (approvalFilter === "unconfirmed" ||
        approvalFilter === "confirmed" ||
        approvalFilter === "rejected")
    ) {
      query = query.eq("approval_status", approvalFilter);
    }

    if (
      includeCefrFilter &&
      (cefrFilter === "unknown" || cefrFilter === "null")
    ) {
      query = query.is("cefr_level", null);
    } else if (
      includeCefrFilter &&
      PASSIVE_VOCABULARY_CEFR_LEVELS.includes(cefrFilter as never)
    ) {
      query = query.eq("cefr_level", cefrFilter);
    }

    if (includePosFilter && normalizedPosFilters.length > 0) {
      query = query.in("part_of_speech", normalizedPosFilters);
    }

    return query;
  };

  const createLibraryCountQuery = ({
    includeCefrFilter = true,
    includeApprovalFilter = true,
    includePosFilter = true,
  }: QueryFilterOptions = {}) => {
    let query = access.adminClient
      .from("passive_vocabulary_library")
      .select("id", { count: "exact", head: true });

    if (access.role !== "superadmin") {
      query = query.eq("approval_status", "confirmed");
    } else if (
      includeApprovalFilter &&
      (approvalFilter === "unconfirmed" ||
        approvalFilter === "confirmed" ||
        approvalFilter === "rejected")
    ) {
      query = query.eq("approval_status", approvalFilter);
    }

    if (
      includeCefrFilter &&
      (cefrFilter === "unknown" || cefrFilter === "null")
    ) {
      query = query.is("cefr_level", null);
    } else if (
      includeCefrFilter &&
      PASSIVE_VOCABULARY_CEFR_LEVELS.includes(cefrFilter as never)
    ) {
      query = query.eq("cefr_level", cefrFilter);
    }

    if (includePosFilter && normalizedPosFilters.length > 0) {
      query = query.in("part_of_speech", normalizedPosFilters);
    }

    return query;
  };

  const loadExactCount = async (
    query: PromiseLike<{
      count: number | null;
      error: { message?: string } | null;
    }>,
  ) => {
    const { count, error } = await query;

    if (error) {
      throw new Error(
        error.message ?? "Failed to load passive vocabulary library items",
      );
    }

    return count ?? 0;
  };

  const loadFacetCountsExact = async (): Promise<PassiveLibraryFacetCounts> => {
    const counts = createEmptyFacetCounts();

    const cefrPromises = [
      loadExactCount(createLibraryCountQuery({ includeCefrFilter: false })),
      loadExactCount(
        createLibraryCountQuery({ includeCefrFilter: false }).is(
          "cefr_level",
          null,
        ),
      ),
      ...PASSIVE_VOCABULARY_CEFR_LEVELS.map((level) =>
        loadExactCount(
          createLibraryCountQuery({ includeCefrFilter: false }).eq(
            "cefr_level",
            level,
          ),
        ),
      ),
    ];
    const approvalPromises = [
      loadExactCount(createLibraryCountQuery({ includeApprovalFilter: false })),
      ...APPROVAL_FACET_VALUES.filter((value) => value !== "all").map((value) =>
        loadExactCount(
          createLibraryCountQuery({ includeApprovalFilter: false }).eq(
            "approval_status",
            value,
          ),
        ),
      ),
    ];
    const partOfSpeechPromises = PASSIVE_VOCABULARY_PARTS_OF_SPEECH.map(
      (value) =>
        loadExactCount(
          createLibraryCountQuery({ includePosFilter: false }).eq(
            "part_of_speech",
            value,
          ),
        ),
    );

    const [cefrCounts, approvalCounts, partOfSpeechCounts] = await Promise.all([
      Promise.all(cefrPromises),
      Promise.all(approvalPromises),
      Promise.all(partOfSpeechPromises),
    ]);

    counts.cefr.all = cefrCounts[0] ?? 0;
    counts.cefr.unknown = cefrCounts[1] ?? 0;
    PASSIVE_VOCABULARY_CEFR_LEVELS.forEach((level, index) => {
      counts.cefr[level] = cefrCounts[index + 2] ?? 0;
    });

    counts.approval.all = approvalCounts[0] ?? 0;
    APPROVAL_FACET_VALUES.filter((value) => value !== "all").forEach(
      (value, index) => {
        counts.approval[value] = approvalCounts[index + 1] ?? 0;
      },
    );

    PASSIVE_VOCABULARY_PARTS_OF_SPEECH.forEach((value, index) => {
      counts.partOfSpeech[value] = partOfSpeechCounts[index] ?? 0;
    });

    return counts;
  };

  const mergeRowsById = <TRow extends { id: string }>(
    rows: TRow[],
    additionalRows: TRow[],
  ) => {
    const rowsById = new Map<string, TRow>();

    for (const row of rows) {
      rowsById.set(row.id, row);
    }

    for (const row of additionalRows) {
      rowsById.set(row.id, row);
    }

    return Array.from(rowsById.values());
  };

  if (searchQuery) {
    const normalizedSearchQuery = normalizePassiveVocabularyText(searchQuery);
    const [matchingFormsResult, matchingUkrainianFormsResult] =
      await Promise.all([
        access.adminClient
          .from("passive_vocabulary_library_forms")
          .select("library_item_id")
          .eq("normalized_form", normalizedSearchQuery),
        access.adminClient
          .from("passive_vocabulary_library_ukrainian_forms")
          .select("library_item_id")
          .eq("normalized_form", normalizedSearchQuery),
      ]);

    if (matchingFormsResult.error || matchingUkrainianFormsResult.error) {
      return NextResponse.json(
        { error: "Failed to load passive vocabulary library items" },
        { status: 500 },
      );
    }

    const matchingLibraryItemIds = Array.from(
      new Set([
        ...(matchingFormsResult.data ?? []).map((row) => row.library_item_id),
        ...(matchingUkrainianFormsResult.data ?? []).map(
          (row) => row.library_item_id,
        ),
      ]),
    );

    const loadSearchRows = async (
      selectFields: string,
      options: QueryFilterOptions = {},
    ) => {
      const [canonicalMatchesResult, aliasMatchesResult] = await Promise.all([
        createLibraryItemsQuery({ ...options, selectFields }).ilike(
          "canonical_term",
          `%${searchQuery}%`,
        ),
        matchingLibraryItemIds.length > 0
          ? createLibraryItemsQuery({ ...options, selectFields }).in(
              "id",
              matchingLibraryItemIds,
            )
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (canonicalMatchesResult.error || aliasMatchesResult.error) {
        throw new Error("Failed to load passive vocabulary library items");
      }

      return mergeRowsById(
        asRowArray<{ id: string }>(canonicalMatchesResult.data),
        asRowArray<{ id: string }>(aliasMatchesResult.data),
      );
    };

    try {
      const [mergedAdminRows, cefrFacetRows, approvalFacetRows, posFacetRows] =
        await Promise.all([
          loadSearchRows(LIBRARY_ITEM_SELECT_FIELDS),
          loadSearchRows(LIBRARY_FACET_SELECT_FIELDS, {
            includeCefrFilter: false,
          }),
          loadSearchRows(LIBRARY_FACET_SELECT_FIELDS, {
            includeApprovalFilter: false,
          }),
          loadSearchRows(LIBRARY_FACET_SELECT_FIELDS, {
            includePosFilter: false,
          }),
        ]);

      const mergedItems = asRowArray<PassiveVocabularyLibraryAdminItemRow>(
        mergedAdminRows,
      ).sort(compareLibraryRowsAlphabetically);
      const paginatedItems = mergedItems.slice(offset, offset + limit + 1);

      return NextResponse.json({
        items: paginatedItems.slice(0, limit).map(toAdminItem),
        hasMore: paginatedItems.length > limit,
        facetCounts: buildFacetCountsFromRows({
          cefrRows: asRowArray<PassiveLibraryFacetRow>(cefrFacetRows),
          approvalRows: asRowArray<PassiveLibraryFacetRow>(approvalFacetRows),
          posRows: asRowArray<PassiveLibraryFacetRow>(posFacetRows),
        }),
        availableCefrLevels: PASSIVE_VOCABULARY_CEFR_LEVELS,
        availablePartsOfSpeech: PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
      });
    } catch {
      return NextResponse.json(
        { error: "Failed to load passive vocabulary library items" },
        { status: 500 },
      );
    }
  }

  try {
    const [dataResult, facetCounts] = await Promise.all([
      createLibraryItemsQuery({ orderAlphabetically: true }).range(
        offset,
        offset + limit,
      ),
      loadFacetCountsExact(),
    ]);

    if (dataResult.error) {
      return NextResponse.json(
        { error: "Failed to load passive vocabulary library items" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      items: asRowArray<PassiveVocabularyLibraryAdminItemRow>(dataResult.data)
        .slice(0, limit)
        .map(toAdminItem),
      hasMore:
        asRowArray<PassiveVocabularyLibraryAdminItemRow>(dataResult.data)
          .length > limit,
      facetCounts,
      availableCefrLevels: PASSIVE_VOCABULARY_CEFR_LEVELS,
      availablePartsOfSpeech: PASSIVE_VOCABULARY_PARTS_OF_SPEECH,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load passive vocabulary library items" },
      { status: 500 },
    );
  }
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

    if (!normalizedTerm || !isEnglishWord(trimmedTerm)) {
      continue;
    }

    const itemType =
      rawItem.itemType === "phrase" ||
      inferPassiveVocabularyItemType(trimmedTerm) === "phrase"
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
