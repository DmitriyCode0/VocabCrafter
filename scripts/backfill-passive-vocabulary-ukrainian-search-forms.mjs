import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !serviceRoleKey || !geminiApiKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are required.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

const BATCH_SIZE = 16;
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const nowIso = new Date().toISOString();

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[’ʼ`]/g, "'")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeAttributeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function getAttributes(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function getUkrainianTranslation(attributes) {
  return normalizeAttributeText(
    attributes.ukrainianTranslation ?? attributes.ukrainian_translation,
  );
}

function normalizeUkrainianSearchForms(forms, ukrainianTranslation) {
  const normalizedForms = new Map();

  const addCandidate = (candidate) => {
    const normalizedCandidate = normalizeAttributeText(candidate);

    if (!normalizedCandidate) {
      return;
    }

    for (const segment of normalizedCandidate.split(/[\n,;/]+/)) {
      const normalizedSegment = normalizeAttributeText(segment);
      const normalizedLookupValue = normalizeText(normalizedSegment ?? "");

      if (
        !normalizedSegment ||
        !normalizedLookupValue ||
        normalizedForms.has(normalizedLookupValue)
      ) {
        continue;
      }

      normalizedForms.set(normalizedLookupValue, normalizedSegment);
    }
  };

  addCandidate(ukrainianTranslation);

  if (Array.isArray(forms)) {
    for (const form of forms) {
      addCandidate(form);
    }
  }

  return Array.from(normalizedForms.values()).slice(0, 24);
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

    const requestedId =
      typeof item.requestedId === "string" ? item.requestedId.trim() : "";
    const searchForms = normalizeUkrainianSearchForms(item.searchForms, null);

    if (!requestedId || searchForms.length === 0) {
      return [];
    }

    return [{ requestedId, searchForms }];
  });
}

async function generateSearchForms(batch) {
  const prompt = [
    "For each item, return Ukrainian reverse-search forms that should help a learner find the English dictionary entry.",
    "Rules:",
    "- requestedId must be copied exactly as provided",
    "- searchForms must be an array of up to 8 concise Ukrainian forms",
    "- always include the provided Ukrainian translation",
    "- add close aspectual or inflected variants only when they are natural and directly related",
    "- do not include explanations, English text, or unrelated synonyms",
    'Respond with JSON in this exact shape: { "items": [ { "requestedId": "...", "searchForms": ["..."] } ] }.',
    "Examples:",
    '- requestedId: "1", canonicalTerm: "to lose", ukrainianTranslation: "втрачати" -> ["втрачати", "втратити", "втратив", "втратила"]',
    '- requestedId: "2", canonicalTerm: "a table", ukrainianTranslation: "стіл" -> ["стіл", "стола", "столи"]',
    "Items:",
    ...batch.map(
      (item) =>
        `- requestedId: "${item.id}", canonicalTerm: "${item.canonical_term}", partOfSpeech: "${item.part_of_speech ?? "unknown"}", ukrainianTranslation: "${item.ukrainianTranslation}"`,
    ),
  ].join("\n");

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
    config: {
      systemInstruction:
        "You generate compact Ukrainian lookup forms for a private dictionary search index. Return only valid JSON.",
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  return normalizeResponseItems(parseJsonPayload(response.text));
}

async function syncUkrainianForms(libraryItemId, forms) {
  const normalizedFormsByValue = new Map(
    forms.map((form) => [normalizeText(form), form]),
  );

  const { data: existingRows, error: existingRowsError } = await supabase
    .from("passive_vocabulary_library_ukrainian_forms")
    .select("id, normalized_form")
    .eq("library_item_id", libraryItemId);

  if (existingRowsError) {
    throw existingRowsError;
  }

  const rowsToDelete = (existingRows ?? [])
    .filter((row) => !normalizedFormsByValue.has(row.normalized_form))
    .map((row) => row.id);

  if (rowsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("passive_vocabulary_library_ukrainian_forms")
      .delete()
      .in("id", rowsToDelete);

    if (deleteError) {
      throw deleteError;
    }
  }

  if (normalizedFormsByValue.size === 0) {
    return;
  }

  const { error: upsertError } = await supabase
    .from("passive_vocabulary_library_ukrainian_forms")
    .upsert(
      Array.from(normalizedFormsByValue.entries()).map(
        ([normalizedForm, formTerm]) => ({
          library_item_id: libraryItemId,
          form_term: formTerm,
          normalized_form: normalizedForm,
          updated_at: nowIso,
        }),
      ),
      { onConflict: "library_item_id,normalized_form" },
    );

  if (upsertError) {
    throw upsertError;
  }
}

const { data: libraryRows, error: libraryError } = await supabase
  .from("passive_vocabulary_library")
  .select("id, canonical_term, part_of_speech, attributes")
  .order("canonical_term", { ascending: true });

if (libraryError) {
  throw libraryError;
}

const rows = (libraryRows ?? [])
  .map((row) => {
    const attributes = getAttributes(row.attributes);
    const ukrainianTranslation = getUkrainianTranslation(attributes);
    const existingSearchForms = normalizeUkrainianSearchForms(
      attributes.ukrainianSearchForms,
      ukrainianTranslation,
    );

    return {
      ...row,
      attributes,
      ukrainianTranslation,
      existingSearchForms,
    };
  })
  .filter(
    (row) => row.ukrainianTranslation && (force || row.existingSearchForms.length <= 1),
  );

let updated = 0;
let skipped = 0;

for (let index = 0; index < rows.length; index += BATCH_SIZE) {
  const batch = rows.slice(index, index + BATCH_SIZE);
  console.log(
    `Processing batch ${Math.floor(index / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} items)`,
  );

  const generatedRows = await generateSearchForms(batch);
  const generatedById = new Map(
    generatedRows.map((item) => [item.requestedId, item.searchForms]),
  );

  for (const row of batch) {
    const nextSearchForms = normalizeUkrainianSearchForms(
      generatedById.get(row.id) ?? row.existingSearchForms,
      row.ukrainianTranslation,
    );

    if (nextSearchForms.length === 0) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            id: row.id,
            canonicalTerm: row.canonical_term,
            ukrainianTranslation: row.ukrainianTranslation,
            ukrainianSearchForms: nextSearchForms,
          },
          null,
          2,
        ),
      );
      updated += 1;
      continue;
    }

    const nextAttributes = {
      ...row.attributes,
      ukrainianSearchForms: nextSearchForms,
    };

    const { error: updateError } = await supabase
      .from("passive_vocabulary_library")
      .update({
        attributes: nextAttributes,
        updated_at: nowIso,
      })
      .eq("id", row.id);

    if (updateError) {
      throw updateError;
    }

    await syncUkrainianForms(row.id, nextSearchForms);
    updated += 1;
  }
}

console.log(
  JSON.stringify(
    {
      scanned: rows.length,
      updated,
      skipped,
      dryRun,
      force,
    },
    null,
    2,
  ),
);