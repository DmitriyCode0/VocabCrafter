import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getTotalPages } from "@/lib/pagination";

interface PagePaginationProps {
  pathname: string;
  currentPage: number;
  pageSize: number;
  totalItems: number;
  searchParams?: Record<string, string | string[] | undefined>;
  pageParam?: string;
}

export function PagePagination({
  pathname,
  currentPage,
  pageSize,
  totalItems,
  searchParams,
  pageParam = "page",
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
        Showing {startItem}-{endItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
          <Link
            href={buildHref(currentPage - 1)}
            aria-disabled={currentPage <= 1}
          >
            Previous
          </Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
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
            Next
          </Link>
        </Button>
      </div>
    </div>
  );
}
