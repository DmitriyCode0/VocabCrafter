import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardHeader } from "@/components/ui/card";

export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <LoadingSkeleton lines={4} />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
