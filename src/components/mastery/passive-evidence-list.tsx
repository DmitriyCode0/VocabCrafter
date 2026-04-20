import { Badge } from "@/components/ui/badge";
import { DeletePassiveEvidenceButton } from "@/components/mastery/delete-passive-evidence-button";
import { EditPassiveEvidenceDialog } from "@/components/mastery/edit-passive-evidence-dialog";
import { formatAppDate } from "@/lib/dates";
import { formatPassiveVocabularyPartOfSpeech } from "@/lib/mastery/passive-vocabulary";

export interface PassiveEvidenceListItem {
  id: string;
  term: string;
  definition: string | null;
  item_type: "word" | "phrase";
  source_type: "full_text" | "manual_list" | "curated_list";
  source_label: string | null;
  import_count: number;
  last_imported_at: string;
  library_cefr_level?: string | null;
  library_part_of_speech?: string | null;
  recognitionWeight?: number;
}

function formatRecognitionWeight(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2);
}

interface PassiveEvidenceListProps {
  items: PassiveEvidenceListItem[];
  emptyMessage: string;
}

export function PassiveEvidenceList({
  items,
  emptyMessage,
}: PassiveEvidenceListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.term}</p>
              {item.definition && (
                <p className="truncate text-xs text-muted-foreground">
                  {item.definition}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <EditPassiveEvidenceDialog evidence={item} />
              <DeletePassiveEvidenceButton
                evidenceId={item.id}
                term={item.term}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {item.item_type === "phrase" ? "Phrase" : "Word"}
            </Badge>
            <Badge variant="outline">
              {item.source_type.replaceAll("_", " ")}
            </Badge>
            {item.library_cefr_level && (
              <Badge variant="secondary">{item.library_cefr_level}</Badge>
            )}
            {item.library_part_of_speech && (
              <Badge variant="outline">
                {formatPassiveVocabularyPartOfSpeech(item.library_part_of_speech)}
              </Badge>
            )}
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            {item.source_label && <p>Source: {item.source_label}</p>}
            <p>
              Imported {item.import_count} time
              {item.import_count !== 1 ? "s" : ""}
            </p>
            <p>Last updated {formatAppDate(item.last_imported_at)}</p>
            {item.recognitionWeight != null && item.recognitionWeight < 1 && (
              <p>
                Counts {formatRecognitionWeight(item.recognitionWeight)}x toward
                the passive estimate at the current CEFR target.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}