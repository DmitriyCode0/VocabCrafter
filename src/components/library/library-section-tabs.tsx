"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, FileText, Loader2 } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type LibrarySection = "grammar" | "dictionary";

interface LibrarySectionTabsProps {
  currentSection: LibrarySection;
  basePath?: string;
}

export function LibrarySectionTabs({
  currentSection,
  basePath = "/library",
}: LibrarySectionTabsProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const [loadingTab, setLoadingTab] = useState<LibrarySection | null>(null);
  const sections = [
    {
      value: "grammar",
      href: basePath,
      label: messages.library.grammarTab,
      icon: FileText,
    },
    {
      value: "dictionary",
      href: `${basePath}/dictionary`,
      label: messages.library.dictionaryTab,
      icon: BookMarked,
    },
  ] as const;

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
        className="mx-auto grid h-auto w-full max-w-3xl grid-cols-2 rounded-none border-b border-border/60 bg-transparent p-0"
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