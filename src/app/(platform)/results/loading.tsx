import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ResultsLoading() {
  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-52 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-56 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-md bg-muted" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-muted mb-1" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
