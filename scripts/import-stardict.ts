/**
 * One-time StarDict -> Supabase Layer 1 (`reference_dictionary_entries`) importer.
 *
 * Usage:
 *   npx tsx scripts/import-stardict.ts /path/to/dictionary.ifo [--lang-pair=en-uk] [--dry-run]
 *
 * Expects `.idx` and `.dict` (or `.dict.dz`) alongside the `.ifo` file, plus
 * `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or env.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

interface StarDictMeta {
  bookname: string;
  wordcount: number;
  idxoffsetbits: 32 | 64;
  sametypesequence: string;
}

interface ParsedEntry {
  headword: string;
  normalized_headword: string;
  item_type: "word" | "phrase";
  part_of_speech: string | null;
  ipa_us: string | null;
  ipa_uk: string | null;
  short_uk_translation: string | null;
  senses: Array<{ pos?: string; translations: string[] }>;
  source_dict: string;
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let val = trimmed.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function parseIfo(ifoPath: string): StarDictMeta {
  const raw = fs.readFileSync(ifoPath, "utf8");
  const fields = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx > 0) {
      fields.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
  }

  return {
    bookname: fields.get("bookname") || path.basename(ifoPath, ".ifo"),
    wordcount: Number(fields.get("wordcount") || "0"),
    idxoffsetbits: fields.get("idxoffsetbits") === "64" ? 64 : 32,
    sametypesequence: fields.get("sametypesequence") || "m",
  };
}

function normalizeHeadword(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ");
}

function stripMarkup(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|kref|dtrn)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractIpa(cleaned: string): string | null {
  const match = cleaned.match(/[\[\/]([^\]\/\n]{1,40})[\]\/]/);
  return match ? `/${match[1].trim()}/` : null;
}

function extractPos(cleaned: string): string | null {
  const match = cleaned.match(
    /\b(noun|verb|adj(?:ective)?|adv(?:erb)?|prep(?:osition)?|conj(?:unction)?|pron(?:oun)?|interj(?:ection)?|modal verb|phrasal verb)\b/i,
  );
  if (!match) return null;
  const rawPos = match[1].toLowerCase();
  if (rawPos.startsWith("adj")) return "adjective";
  if (rawPos.startsWith("adv")) return "adverb";
  if (rawPos.startsWith("prep")) return "preposition";
  if (rawPos.startsWith("conj")) return "conjunction";
  if (rawPos.startsWith("pron")) return "pronoun";
  if (rawPos.startsWith("interj")) return "interjection";
  return rawPos;
}

function extractUkrainianSummary(cleaned: string): {
  shortUk: string | null;
  translations: string[];
} {
  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /[а-яА-ЯіІїЇєЄґҐ]/.test(line));

  const translations: string[] = [];
  for (const line of lines) {
    const parts = line
      .split(/[;,]/)
      .map((p) => p.replace(/^\d+[.)]\s*/, "").trim())
      .filter((p) => /[а-яА-ЯіІїЇєЄґҐ]/.test(p) && p.length <= 120);
    for (const part of parts) {
      if (!translations.includes(part)) {
        translations.push(part);
      }
      if (translations.length >= 6) break;
    }
    if (translations.length >= 6) break;
  }

  return {
    shortUk: translations.slice(0, 3).join("; ") || null,
    translations,
  };
}

function parseStarDictFiles(
  ifoPath: string,
  sourceDictName: string,
): ParsedEntry[] {
  const basePath = ifoPath.replace(/\.ifo$/i, "");
  const idxPath = `${basePath}.idx`;
  const dictDzPath = `${basePath}.dict.dz`;
  const dictPath = `${basePath}.dict`;

  if (!fs.existsSync(idxPath)) {
    throw new Error(`Missing index file: ${idxPath}`);
  }

  let dictBuf: Buffer;
  if (fs.existsSync(dictPath)) {
    dictBuf = fs.readFileSync(dictPath);
  } else if (fs.existsSync(dictDzPath)) {
    dictBuf = zlib.gunzipSync(fs.readFileSync(dictDzPath));
  } else {
    throw new Error(`Missing dictionary file: ${dictPath} or ${dictDzPath}`);
  }

  const meta = parseIfo(ifoPath);
  const idxBuf = fs.readFileSync(idxPath);
  const offsetBytes = meta.idxoffsetbits === 64 ? 8 : 4;

  const entriesByKey = new Map<string, ParsedEntry>();
  let cursor = 0;

  while (cursor < idxBuf.length) {
    const nullPos = idxBuf.indexOf(0, cursor);
    if (nullPos === -1) break;

    const headword = idxBuf.subarray(cursor, nullPos).toString("utf8").trim();
    cursor = nullPos + 1;

    if (cursor + offsetBytes + 4 > idxBuf.length) break;

    const dataOffset =
      offsetBytes === 8
        ? Number(idxBuf.readBigUInt64BE(cursor))
        : idxBuf.readUInt32BE(cursor);
    const dataSize = idxBuf.readUInt32BE(cursor + offsetBytes);
    cursor += offsetBytes + 4;

    if (!headword || headword.length > 160) continue;

    const rawDef = dictBuf
      .subarray(dataOffset, dataOffset + dataSize)
      .toString("utf8");
    const cleaned = stripMarkup(rawDef);
    const { shortUk, translations } = extractUkrainianSummary(cleaned);
    if (!shortUk) continue;

    const normalized = normalizeHeadword(headword);
    if (!normalized) continue;

    const itemType: "word" | "phrase" = normalized.includes(" ")
      ? "phrase"
      : "word";
    const key = `${normalized}::${itemType}`;
    const pos = extractPos(cleaned);
    const ipa = extractIpa(cleaned);

    if (!entriesByKey.has(key)) {
      entriesByKey.set(key, {
        headword,
        normalized_headword: normalized,
        item_type: itemType,
        part_of_speech: pos,
        ipa_us: ipa,
        ipa_uk: null,
        short_uk_translation: shortUk.slice(0, 240),
        senses: translations.length > 0 ? [{ pos: pos ?? undefined, translations }] : [],
        source_dict: sourceDictName,
      });
    }
  }

  return Array.from(entriesByKey.values());
}

async function main() {
  loadEnvLocal();

  const args = process.argv.slice(2);
  const ifoArg = args.find((arg) => !arg.startsWith("--"));
  const langPair =
    args.find((arg) => arg.startsWith("--lang-pair="))?.split("=")[1] ??
    "en-uk";
  const dryRun = args.includes("--dry-run");

  if (!ifoArg) {
    console.error(
      "Usage: npx tsx scripts/import-stardict.ts /path/to/dict.ifo [--lang-pair=en-uk] [--dry-run]",
    );
    process.exit(1);
  }

  const ifoPath = path.resolve(ifoArg);
  const meta = parseIfo(ifoPath);
  console.log(`Parsing StarDict "${meta.bookname}" (${meta.wordcount} entries)...`);

  const entries = parseStarDictFiles(ifoPath, meta.bookname);
  console.log(`Prepared ${entries.length} EN->UK entries.`);

  if (dryRun) {
    console.log("Sample entries:", entries.slice(0, 5));
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize).map((entry) => ({
      language_pair: langPair,
      ...entry,
    }));

    const { error } = await admin
      .from("reference_dictionary_entries")
      .upsert(batch, {
        onConflict: "language_pair,normalized_headword,item_type",
      });

    if (error) {
      throw new Error(`Batch ${i}-${i + batch.length} failed: ${error.message}`);
    }

    inserted += batch.length;
    if (inserted % 5000 === 0 || inserted === entries.length) {
      console.log(`Uploaded ${inserted}/${entries.length} entries...`);
    }
  }

  console.log("StarDict import completed successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
