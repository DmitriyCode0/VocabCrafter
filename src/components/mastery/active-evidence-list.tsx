import { Badge } from "@/components/ui/badge";
import { DeleteActiveEvidenceButton } from "@/components/mastery/delete-active-evidence-button";
import { formatAppDate } from "@/lib/dates";
import { formatPassiveVocabularyPartOfSpeech } from "@/lib/mastery/passive-vocabulary";

export interface ActiveEvidenceListItem {
  id: string;
  term: string;
  source_type: "lesson_recording" | "manual_list" | "other";
  source_label: string | null;
  usage_count: number;
  first_used_at: string;
  last_used_at: string;
  library_cefr_level?: string | null;
  library_part_of_speech?: string | null;
}

interface ActiveEvidenceListProps {
  items: ActiveEvidenceListItem[];
  emptyMessage: string;
  canDelete?: boolean;
  deleteTitle?: string;
  getDeleteDescription?: (term: string) => string;
  getDeleteSuccessMessage?: (term: string) => string;
  onItemDeleted?: (itemId: string) => void;
}

function formatActiveEvidenceSourceType(
  value: ActiveEvidenceListItem["source_type"],
) {
  switch (value) {
    case "lesson_recording":
      return "lesson recording";
    case "manual_list":
      return "manual list";
    default:
      return "other";
  }
}

export function ActiveEvidenceList({
  items,
  emptyMessage,
  canDelete = false,
  deleteTitle,
  getDeleteDescription,
  getDeleteSuccessMessage,
  onItemDeleted,
}: ActiveEvidenceListProps) {
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
        <div
          key={item.id}
          className="flex flex-col gap-3 rounded-lg border p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.term}</p>
            </div>

            {canDelete ? (
              <DeleteActiveEvidenceButton
                evidenceId={item.id}
                term={item.term}
                title={deleteTitle}
                description={getDeleteDescription?.(item.term)}
                successMessage={getDeleteSuccessMessage?.(item.term)}
                onDeleted={onItemDeleted}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">
              {formatActiveEvidenceSourceType(item.source_type)}
            </Badge>
            {item.library_cefr_level ? (
              <Badge variant="secondary">{item.library_cefr_level}</Badge>
            ) : null}
            {item.library_part_of_speech ? (
              <Badge variant="outline">
                {formatPassiveVocabularyPartOfSpeech(
                  item.library_part_of_speech,
                )}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            {item.source_label ? <p>Source: {item.source_label}</p> : null}
            <p>
              Used {item.usage_count} time{item.usage_count !== 1 ? "s" : ""}
            </p>
            <p>First seen {formatAppDate(item.first_used_at)}</p>
            <p>Last seen {formatAppDate(item.last_used_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
