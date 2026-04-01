import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonShimmer } from "@/components/ui/animated";

export default function PlatformLoading() {
  return (
    <div className="space-y-6 animate-page-enter">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-md skeleton-shimmer" />
        <div className="h-4 w-80 rounded-md skeleton-shimmer" />
      </div>

      {/* Stats row skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 rounded skeleton-shimmer" />
              <div className="h-4 w-4 rounded skeleton-shimmer" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded skeleton-shimmer mb-1" />
              <div className="h-3 w-24 rounded skeleton-shimmer" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <SkeletonShimmer lines={3} />
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
