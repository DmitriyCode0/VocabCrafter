import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardHeader } from "@/components/ui/card";

export default function QuizzesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <LoadingSkeleton lines={3} />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
