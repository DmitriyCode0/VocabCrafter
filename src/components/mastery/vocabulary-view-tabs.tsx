"use client";

import Link from "next/link";
import { BookMarked, Zap } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VocabularyViewTabsProps {
  activeTab: "active" | "passive";
  activeHref?: string;
  passiveHref: string;
  className?: string;
}

export function VocabularyViewTabs({
  activeTab,
  activeHref,
  passiveHref,
  className,
}: VocabularyViewTabsProps) {
  const { messages } = useAppI18n();

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {activeHref ? (
        <Button
          asChild
          variant={activeTab === "active" ? "default" : "outline"}
        >
          <Link href={activeHref}>
            <Zap className="mr-2 h-4 w-4" />
            {messages.vocabularyTabs.active}
          </Link>
        </Button>
      ) : null}

      <Button asChild variant={activeTab === "passive" ? "default" : "outline"}>
        <Link href={passiveHref}>
          <BookMarked className="mr-2 h-4 w-4" />
          {messages.vocabularyTabs.passive}
        </Link>
      </Button>
    </div>
  );
}
