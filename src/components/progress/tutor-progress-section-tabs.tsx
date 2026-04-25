"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, BookMarked, Loader2, TrendingUp } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TutorProgressSectionTabsProps {
  currentSection: "overall" | "monthly" | "coaching";
  basePath: string;
}

export function TutorProgressSectionTabs({
  currentSection,
  basePath,
}: TutorProgressSectionTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { messages } = useAppI18n();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const sections = [
    {
      value: "overall",
      href: basePath,
      label: messages.progress.overallTab,
      icon: TrendingUp,
    },
    {
      value: "monthly",
      href: `${basePath}/monthly`,
      label: messages.progress.monthlyTab,
      icon: BarChart3,
    },
    {
      value: "coaching",
      href: `${basePath}/coaching`,
      label: messages.tutorProgressPage.coachingTab,
      icon: BookMarked,
    },
  ] as const;

  return (
    <Tabs
      value={currentSection}
      onValueChange={(value) => {
        const nextSection = sections.find((section) => section.value === value);

        if (value === currentSection || !nextSection) {
          return;
        }

        setLoadingTab(value);
        const queryString = searchParams.toString();
        const href = nextSection.href;
        router.push(queryString ? `${href}?${queryString}` : href);
      }}
      className="w-full pb-3"
    >
      <TabsList
        variant="line"
        className="mx-auto grid h-auto w-full max-w-4xl grid-cols-3 rounded-none border-b border-border/60 bg-transparent p-0"
      >
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <TabsTrigger
              key={section.value}
              value={section.value}
              className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
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
