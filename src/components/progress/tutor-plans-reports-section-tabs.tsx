"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2, Target } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TutorPlansReportsSectionTabsProps {
  currentSection: "plans" | "reports";
  basePath: string;
}

export function TutorPlansReportsSectionTabs({
  currentSection,
  basePath,
}: TutorPlansReportsSectionTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { messages } = useAppI18n();
  const [loadingTab, setLoadingTab] = useState<string | null>(null);

  return (
    <Tabs
      value={currentSection}
      onValueChange={(value) => {
        if (
          value === currentSection ||
          (value !== "plans" && value !== "reports")
        ) {
          return;
        }

        setLoadingTab(value);
        const queryString = searchParams.toString();
        const href = value === "plans" ? basePath : `${basePath}/reports`;
        router.push(queryString ? `${href}?${queryString}` : href);
      }}
      className="w-full pb-3"
    >
      <TabsList
        variant="line"
        className="mx-auto grid h-auto w-full max-w-3xl grid-cols-2 rounded-none border-b border-border/60 bg-transparent p-0"
      >
        <TabsTrigger
          value="plans"
          className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "plans" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Target className="h-5 w-5" />
          )}
          {messages.tutorPlansReportsPage.plansTab}
        </TabsTrigger>
        <TabsTrigger
          value="reports"
          className="h-14 rounded-none px-4 pb-4 text-base font-semibold sm:text-lg after:bottom-[-1px]"
        >
          {loadingTab === "reports" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
          {messages.tutorPlansReportsPage.reportsTab}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}