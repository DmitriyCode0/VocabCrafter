import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardHeader } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <Card>
        <CardHeader>
          <LoadingSkeleton lines={5} />
        </CardHeader>
      </Card>
    </div>
  );
}
