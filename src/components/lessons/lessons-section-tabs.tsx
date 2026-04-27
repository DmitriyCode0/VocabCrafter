"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Loader2, Video, Wallet } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/roles";

export type LessonsSection =
  | "schedule"
  | "classroom"
  | "performance"
  | "balance";

interface LessonsSectionTabsProps {
  role: Role;
  currentSection: LessonsSection;
  scheduleHref?: string;
}

export function LessonsSectionTabs({
  role,
  currentSection,
  scheduleHref = "/lessons",
}: LessonsSectionTabsProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [loadingTab, setLoadingTab] = useState<LessonsSection | null>(null);
  const sections =
    role === "tutor"
      ? [
          {
            value: "schedule" as const,
            href: scheduleHref,
            label: messages.lessons.scheduleTab,
            icon: CalendarDays,
          },
          {
            value: "classroom" as const,
            href: "/lessons/classroom",
            label: messages.lessons.classroomTab,
            icon: Video,
          },
          {
            value: "performance" as const,
            href: "/lessons/performance",
            label: messages.lessons.performanceTab,
            icon: BarChart3,
          },
          {
            value: "balance" as const,
            href: "/lessons/balance",
            label: messages.lessons.balanceTab,
            icon: Wallet,
          },
        ]
      : [
          {
            value: "schedule" as const,
            href: scheduleHref,
            label: messages.lessons.scheduleTab,
            icon: CalendarDays,
          },
          {
            value: "classroom" as const,
            href: "/lessons/classroom",
            label: messages.lessons.classroomTab,
            icon: Video,
          },
        ];

  return (
    <Tabs
      value={currentSection}
      onValueChange={(value) => {
        const nextSection = sections.find((section) => section.value === value);

        if (!nextSection || value === currentSection) {
          return;
        }

        setLoadingTab(nextSection.value);
        router.push(nextSection.href);
      }}
      className="w-full pb-3"
    >
      <TabsList
        variant="line"
        className={cn(
          "mx-auto grid h-auto w-full max-w-4xl rounded-none border-b border-border/60 bg-transparent p-0",
          sections.length === 2 ? "grid-cols-2" : "grid-cols-4",
        )}
      >
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <TabsTrigger
              key={section.value}
              value={section.value}
              className="h-14 rounded-none px-3 pb-4 text-sm font-semibold sm:text-base lg:text-lg after:bottom-[-1px]"
            >
              {loadingTab === section.value ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon className="h-5 w-5" />
              )}
              {section.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
