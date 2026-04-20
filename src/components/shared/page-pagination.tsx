import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AppMessages } from "@/lib/i18n/messages";
import { getTotalPages } from "@/lib/pagination";

type PagePaginationLabels = AppMessages["pagination"];

const DEFAULT_LABELS: PagePaginationLabels = {
  showing: "Showing",
  of: "of",
  previous: "Previous",
  next: "Next",
  page: "Page",
};

interface PagePaginationProps {
  pathname: string;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  searchParams?: Record<string, string | string[] | undefined>;
  pageParam?: string;
  labels?: PagePaginationLabels;
}

export function PagePagination({
  pathname,
  currentPage,
  pageSize,
  totalItems,
  searchParams,
  pageParam = "page",
  labels = DEFAULT_LABELS,
}: PagePaginationProps) {
  const totalPages = getTotalPages(totalItems, pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  function buildHref(page: number) {
    const params = new URLSearchParams();

    Object.entries(searchParams ?? {}).forEach(([key, value]) => {
      if (key === pageParam || value == null) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
        return;
      }

      params.set(key, value);
    });

    if (page > 1) {
      params.set(pageParam, String(page));
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {labels.showing} {startItem}-{endItem} {labels.of} {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
          <Link
            href={buildHref(currentPage - 1)}
            aria-disabled={currentPage <= 1}
          >
            {labels.previous}
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          {labels.page} {currentPage} {labels.of} {totalPages}
        </span>
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
        >
          <Link
            href={buildHref(currentPage + 1)}
            aria-disabled={currentPage >= totalPages}
          >
            {labels.next}
          </Link>
        </Button>
      </div>
    </div>
  );
}
