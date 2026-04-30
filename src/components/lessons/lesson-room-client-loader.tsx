"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { LessonRoomClientProps } from "./lesson-room-client";

const LessonRoomClient = dynamic(
  () =>
    import("@/components/lessons/lesson-room-client").then(
      (m) => m.LessonRoomClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 rounded-xl border p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    ),
  },
);

export function LessonRoomClientLoader(props: LessonRoomClientProps) {
  return <LessonRoomClient {...props} />;
}
