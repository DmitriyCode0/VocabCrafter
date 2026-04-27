"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Loader2, Wallet } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LessonsSection = "schedule" | "performance" | "balance";

interface LessonsSectionTabsProps {
  currentSection: LessonsSection;
  scheduleHref?: string;
}

export function LessonsSectionTabs({
  currentSection,
  scheduleHref = "/lessons",
}: LessonsSectionTabsProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [loadingTab, setLoadingTab] = useState<LessonsSection | null>(null);

  return (
    <Tabs
      value={currentSection}
      onValueChange={(value) => {
        if (
          value !== "schedule" &&
          value !== "performance" &&
          value !== "balance"
        ) {
          return;
        }

        if (value === currentSection) return;

        setLoadingTab(value);
        router.push(
          value === "schedule"
            ? scheduleHref
            : value === "performance"
              ? "/lessons/performance"
              : "/lessons/balance",
        );
      }}
      className="w-full pb-3"
    >
      <TabsList
        variant="line"
        className="mx-auto grid h-auto w-full max-w-4xl grid-cols-3 rounded-none border-b border-border/60 bg-transparent p-0"
      >
        <TabsTrigger
          value="schedule"
          className="h-14 rounded-none px-3 pb-4 text-sm font-semibold sm:text-base lg:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "schedule" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CalendarDays className="h-5 w-5" />
          )}
          {messages.lessons.scheduleTab}
        </TabsTrigger>
        <TabsTrigger
          value="performance"
          className="h-14 rounded-none px-3 pb-4 text-sm font-semibold sm:text-base lg:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "performance" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <BarChart3 className="h-5 w-5" />
          )}
          {messages.lessons.performanceTab}
        </TabsTrigger>
        <TabsTrigger
          value="balance"
          className="h-14 rounded-none px-3 pb-4 text-sm font-semibold sm:text-base lg:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "balance" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Wallet className="h-5 w-5" />
          )}
          {messages.lessons.balanceTab}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
