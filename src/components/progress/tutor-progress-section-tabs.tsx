"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TutorProgressSectionTabsProps {
  currentSection: "overall" | "monthly";
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

  return (
    <Tabs
      value={currentSection}
      onValueChange={(value) => {
        if (value === currentSection || (value !== "overall" && value !== "monthly")) {
          return;
        }

        setLoadingTab(value);
        const queryString = searchParams.toString();
        const href = value === "overall" ? basePath : `${basePath}/monthly`;
        router.push(queryString ? `${href}?${queryString}` : href);
      }}
      className="w-full pb-3"
    >
      <TabsList
        variant="line"
        className="mx-auto grid h-auto w-full max-w-3xl grid-cols-2 rounded-none border-b border-border/60 bg-transparent p-0"
      >
        <TabsTrigger
          value="overall"
          className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "overall" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <TrendingUp className="h-5 w-5" />
          )}
          {messages.progress.overallTab}
        </TabsTrigger>
        <TabsTrigger
          value="monthly"
          className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "monthly" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <BarChart3 className="h-5 w-5" />
          )}
          {messages.progress.monthlyTab}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}