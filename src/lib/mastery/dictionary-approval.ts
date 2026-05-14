import type { Database } from "@/types/database";

type DictionaryApprovalStatus =
  Database["public"]["Tables"]["passive_vocabulary_library"]["Row"]["approval_status"];

export function hasConfirmedPassiveVocabularyLibraryEntry(
  value:
    | { approval_status: DictionaryApprovalStatus | null }
    | null
    | undefined,
) {
  return value?.approval_status === "confirmed";
}