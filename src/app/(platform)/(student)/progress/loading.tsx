import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardHeader } from "@/components/ui/card";

export default function ProgressLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <LoadingSkeleton lines={2} />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <LoadingSkeleton lines={6} />
        </CardHeader>
      </Card>
    </div>
  );
}
