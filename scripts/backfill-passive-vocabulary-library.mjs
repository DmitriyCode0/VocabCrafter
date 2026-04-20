import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const BATCH_SIZE = 12;
const nowIso = new Date().toISOString();
const CEFR_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
const PARTS_OF_SPEECH = new Set([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "determiner",
  "interjection",
  "phrase",
  "other",
]);
const PART_OF_SPEECH_ALIASES = new Map([
  ["article", "determiner"],
  ["definite article", "determiner"],
  ["indefinite article", "determiner"],
  ["modal", "verb"],
  ["modal verb", "verb"],
  ["auxiliary", "verb"],
  ["auxiliary verb", "verb"],
  ["number", "determiner"],
  ["numeral", "determiner"],
]);

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizePartOfSpeech(value) {
  if (value == null) {
    return null;
  }

  const normalizedValue = normalizeText(value);
  return PART_OF_SPEECH_ALIASES.get(normalizedValue) ?? normalizedValue;
}

function parseJsonPayload(text) {
  const cleaned = String(text ?? "")
    .replace(/```(?:json)?\s*\n?/g, "")
    .replace(/\n?```\s*$/g, "")
    .trim();

  return JSON.parse(cleaned);
}

function normalizeResponseItems(payload) {
  const items = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const requestedTerm =
      typeof item.requestedTerm === "string" ? item.requestedTerm.trim() : "";
    const canonicalTerm =
      typeof item.canonicalTerm === "string" ? item.canonicalTerm.trim() : "";
    const cefrLevel =
      item.cefrLevel == null ? null : String(item.cefrLevel).trim().toUpperCase();
    const partOfSpeech = normalizePartOfSpeech(item.partOfSpeech);
    const attributes =
      item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)
        ? item.attributes
        : {};

    if (!requestedTerm || !canonicalTerm) {
      return [];
    }

    return [
      {
        requestedTerm,
        canonicalTerm,
        cefrLevel: cefrLevel && CEFR_LEVELS.has(cefrLevel) ? cefrLevel : null,
        partOfSpeech:
          partOfSpeech && PARTS_OF_SPEECH.has(partOfSpeech)
            ? partOfSpeech
            : null,
        attributes,
      },
    ];
  });
}

async function generateEnrichment(batch) {
  const prompt = [
    "Target language: English",
    "For each requested single word, return:",
    "- requestedTerm exactly as provided",
    "- canonicalTerm as the base lemma form in the same language",
    "- cefrLevel as the estimated standalone word difficulty for learners",
    "- partOfSpeech",
    "Merge regular noun plurals and regular third-person singular verb forms into the same canonical lemma when appropriate.",
    "Examples: tables -> table, works -> work, studies -> study.",
    "Never translate the word. Never return multiple words as the canonical form for a single-word input.",
    "If the word is already canonical, keep it unchanged.",
    'Respond with JSON in this exact shape: { "items": [ { "requestedTerm": "...", "canonicalTerm": "...", "cefrLevel": "A1", "partOfSpeech": "noun", "attributes": {} } ] }.',
    "Requested terms:",
    ...batch.map((item) => `- ${item.canonical_term}`),
  ].join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
    config: {
      systemInstruction:
        "You are building an internal vocabulary library for a language-learning app. Return only valid JSON and keep the requestedTerm field exactly as supplied.",
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  return normalizeResponseItems(parseJsonPayload(response.text));
}

async function ensureCanonicalForms(
  libraryItemId,
  itemType,
  oldTerm,
  oldNormalized,
  canonicalTerm,
  canonicalNormalized,
) {
  const { error: resetError } = await supabase
    .from("passive_vocabulary_library_forms")
    .update({ is_canonical: false, updated_at: nowIso })
    .eq("library_item_id", libraryItemId);

  if (resetError) {
    throw resetError;
  }

  if (oldNormalized !== canonicalNormalized) {
    const { error: aliasError } = await supabase
      .from("passive_vocabulary_library_forms")
      .upsert(
        {
          library_item_id: libraryItemId,
          form_term: oldTerm,
          normalized_form: oldNormalized,
          item_type: itemType,
          is_canonical: false,
          updated_at: nowIso,
        },
        { onConflict: "normalized_form,item_type" },
      );

    if (aliasError) {
      throw aliasError;
    }
  }

  const { error: canonicalError } = await supabase
    .from("passive_vocabulary_library_forms")
    .upsert(
      {
        library_item_id: libraryItemId,
        form_term: canonicalTerm,
        normalized_form: canonicalNormalized,
        item_type: itemType,
        is_canonical: true,
        updated_at: nowIso,
      },
      { onConflict: "normalized_form,item_type" },
    );

  if (canonicalError) {
    throw canonicalError;
  }
}

async function canonicalizeEvidenceRows(
  libraryItemIds,
  targetLibraryItemId,
  itemType,
  canonicalTerm,
  canonicalNormalized,
) {
  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("passive_vocabulary_evidence")
    .select(
      "id, student_id, term, normalized_term, item_type, definition, source_label, import_count, last_imported_at",
    )
    .in("library_item_id", libraryItemIds)
    .eq("item_type", itemType);

  if (evidenceError) {
    throw evidenceError;
  }

  for (const row of evidenceRows ?? []) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from("passive_vocabulary_evidence")
      .select(
        "id, definition, source_label, import_count, last_imported_at",
      )
      .eq("student_id", row.student_id)
      .eq("item_type", itemType)
      .eq("normalized_term", canonicalNormalized)
      .neq("id", row.id)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicate) {
      const mergedImportCount =
        (duplicate.import_count ?? 0) + (row.import_count ?? 0);
      const mergedLastImportedAt =
        new Date(duplicate.last_imported_at) >= new Date(row.last_imported_at)
          ? duplicate.last_imported_at
          : row.last_imported_at;

      const { error: mergeError } = await supabase
        .from("passive_vocabulary_evidence")
        .update({
          library_item_id: targetLibraryItemId,
          term: canonicalTerm,
          normalized_term: canonicalNormalized,
          definition: duplicate.definition ?? row.definition ?? null,
          source_label: duplicate.source_label ?? row.source_label ?? null,
          import_count: mergedImportCount,
          last_imported_at: mergedLastImportedAt,
          updated_at: nowIso,
        })
        .eq("id", duplicate.id);

      if (mergeError) {
        throw mergeError;
      }

      const { error: deleteError } = await supabase
        .from("passive_vocabulary_evidence")
        .delete()
        .eq("id", row.id);

      if (deleteError) {
        throw deleteError;
      }

      continue;
    }

    const { error: updateError } = await supabase
      .from("passive_vocabulary_evidence")
      .update({
        library_item_id: targetLibraryItemId,
        term: canonicalTerm,
        normalized_term: canonicalNormalized,
        updated_at: nowIso,
      })
      .eq("id", row.id);

    if (updateError) {
      throw updateError;
    }
  }
}

async function updateLibraryMetadata(
  libraryItemId,
  canonicalTerm,
  canonicalNormalized,
  enriched,
) {
  const { error } = await supabase
    .from("passive_vocabulary_library")
    .update({
      canonical_term: canonicalTerm,
      normalized_term: canonicalNormalized,
      cefr_level: enriched.cefrLevel,
      part_of_speech: enriched.partOfSpeech,
      attributes: enriched.attributes ?? {},
      enrichment_status: "completed",
      enrichment_error: null,
      updated_at: nowIso,
    })
    .eq("id", libraryItemId);

  if (error) {
    throw error;
  }
}

const { data: libraryRows, error: libraryError } = await supabase
  .from("passive_vocabulary_library")
  .select("id, canonical_term, normalized_term, item_type, enrichment_status")
  .in("enrichment_status", ["failed", "pending"])
  .eq("item_type", "word")
  .order("updated_at", { ascending: false });

if (libraryError) {
  throw libraryError;
}

const rows = libraryRows ?? [];
let repaired = 0;
let unchanged = 0;

for (let index = 0; index < rows.length; index += BATCH_SIZE) {
  const batch = rows.slice(index, index + BATCH_SIZE);
  console.log(
    `Processing batch ${Math.floor(index / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} items)`,
  );
  const enrichedItems = await generateEnrichment(batch);
  const enrichedByRequestedTerm = new Map(
    enrichedItems.map((item) => [normalizeText(item.requestedTerm), item]),
  );

  for (const row of batch) {
    const enriched = enrichedByRequestedTerm.get(
      normalizeText(row.canonical_term),
    );

    if (!enriched || !enriched.cefrLevel || !enriched.partOfSpeech) {
      unchanged += 1;
      continue;
    }

    const canonicalTerm = normalizeText(enriched.canonicalTerm);
    const canonicalNormalized = normalizeText(canonicalTerm);

    const { data: existingCanonicalRow, error: existingCanonicalRowError } =
      await supabase
        .from("passive_vocabulary_library")
        .select("id, canonical_term, normalized_term, item_type")
        .eq("normalized_term", canonicalNormalized)
        .eq("item_type", row.item_type)
        .neq("id", row.id)
        .maybeSingle();

    if (existingCanonicalRowError) {
      throw existingCanonicalRowError;
    }

    if (existingCanonicalRow) {
      await updateLibraryMetadata(
        existingCanonicalRow.id,
        canonicalTerm,
        canonicalNormalized,
        enriched,
      );
      await ensureCanonicalForms(
        existingCanonicalRow.id,
        row.item_type,
        existingCanonicalRow.canonical_term,
        existingCanonicalRow.normalized_term,
        canonicalTerm,
        canonicalNormalized,
      );
      if (row.normalized_term !== canonicalNormalized) {
        const { error: sourceAliasError } = await supabase
          .from("passive_vocabulary_library_forms")
          .upsert(
            {
              library_item_id: existingCanonicalRow.id,
              form_term: row.canonical_term,
              normalized_form: row.normalized_term,
              item_type: row.item_type,
              is_canonical: false,
              updated_at: nowIso,
            },
            { onConflict: "normalized_form,item_type" },
          );

        if (sourceAliasError) {
          throw sourceAliasError;
        }
      }
      await canonicalizeEvidenceRows(
        [row.id, existingCanonicalRow.id],
        existingCanonicalRow.id,
        row.item_type,
        canonicalTerm,
        canonicalNormalized,
      );
      const { error: deleteSourceLibraryError } = await supabase
        .from("passive_vocabulary_library")
        .delete()
        .eq("id", row.id);

      if (deleteSourceLibraryError) {
        throw deleteSourceLibraryError;
      }

      repaired += 1;
      continue;
    }

    await updateLibraryMetadata(
      row.id,
      canonicalTerm,
      canonicalNormalized,
      enriched,
    );
    await ensureCanonicalForms(
      row.id,
      row.item_type,
      row.canonical_term,
      row.normalized_term,
      canonicalTerm,
      canonicalNormalized,
    );
    await canonicalizeEvidenceRows(
      [row.id],
      row.id,
      row.item_type,
      canonicalTerm,
      canonicalNormalized,
    );
    repaired += 1;
  }
}

const { error: phraseFixError } = await supabase
  .from("passive_vocabulary_library")
  .update({
    part_of_speech: "phrase",
    enrichment_status: "completed",
    enrichment_error: null,
    updated_at: nowIso,
  })
  .eq("item_type", "phrase")
  .in("enrichment_status", ["failed", "pending"]);

if (phraseFixError) {
  throw phraseFixError;
}

console.log(JSON.stringify({ repaired, unchanged, scanned: rows.length }, null, 2));