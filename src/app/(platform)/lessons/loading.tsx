import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LessonsLoading() {
  return (
    <div className="space-y-6 animate-page-enter">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-20 animate-pulse rounded bg-muted mb-1" />
              <div className="h-3 w-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-[26rem] w-full animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    </div>
  );
}
