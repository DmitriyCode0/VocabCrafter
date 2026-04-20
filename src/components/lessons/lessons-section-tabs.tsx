"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LessonsSectionTabsProps {
  currentSection: "schedule" | "performance";
  scheduleHref?: string;
}

export function LessonsSectionTabs({
  currentSection,
  scheduleHref = "/lessons",
}: LessonsSectionTabsProps) {
  const router = useRouter();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  return (
    <Tabs
      value={currentSection}
      onValueChange={(value) => {
        if (value === currentSection) return;
        setLoadingTab(value);
        router.push(
          value === "schedule" ? scheduleHref : "/lessons/performance",
        );
      }}
      className="w-full pb-3"
    >
      <TabsList
        variant="line"
        className="mx-auto grid h-auto w-full max-w-3xl grid-cols-2 rounded-none border-b border-border/60 bg-transparent p-0"
      >
        <TabsTrigger
          value="schedule"
          className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "schedule" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CalendarDays className="h-5 w-5" />
          )}
          Schedule
        </TabsTrigger>
        <TabsTrigger
          value="performance"
          className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "performance" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <BarChart3 className="h-5 w-5" />
          )}
          Performance
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
