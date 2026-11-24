"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Loader2, Wallet } from "lucide-react";
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
        ];

  if (sections.length <= 1) {
    return null;
  }

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
      className="w-auto"
    >
      <TabsList className="inline-flex h-auto items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1 shadow-xs">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <TabsTrigger
              key={section.value}
              value={section.value}
              className={cn(
                "h-9 gap-2 rounded-lg border border-transparent px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-all after:hidden",
                "hover:bg-accent/30 hover:text-foreground",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs",
                "dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground",
              )}
            >
              {loadingTab === section.value ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span>{section.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
