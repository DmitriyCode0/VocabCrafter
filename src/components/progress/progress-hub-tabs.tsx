"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Brain,
  FileText,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProgressHubTabIcon =
  | "overview"
  | "students"
  | "vocabulary"
  | "plan"
  | "reports"
  | "monthly";

export interface ProgressHubTabItem {
  value: string;
  label: string;
  icon: ProgressHubTabIcon;
}

const TAB_ICONS: Record<
  ProgressHubTabIcon,
  React.ComponentType<{ className?: string }>
> = {
  overview: TrendingUp,
  students: Users,
  vocabulary: Brain,
  plan: Target,
  reports: FileText,
  monthly: BarChart3,
};

interface ProgressHubTabsProps {
  activeTab: string;
  basePath: string;
  tabs: ProgressHubTabItem[];
  preserveParams?: string[];
}

export function ProgressHubTabs({
  activeTab,
  basePath,
  tabs,
  preserveParams = ["student", "month", "tutor"],
}: ProgressHubTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  function handleSelectTab(nextValue: string) {
    if (nextValue === activeTab) {
      return;
    }

    const nextParams = new URLSearchParams();
    for (const key of preserveParams) {
      const value = searchParams.get(key);
      if (value) {
        nextParams.set(key, value);
      }
    }
    nextParams.set("tab", nextValue);

    setPendingTab(nextValue);
    startTransition(() => {
      router.push(`${basePath}?${nextParams.toString()}`);
    });
  }

  return (
    <div
      role="tablist"
      aria-label="Progress sections"
      className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1 shadow-xs"
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.icon];
        const isActive = tab.value === activeTab;
        const isLoading = isPending && pendingTab === tab.value;

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelectTab(tab.value)}
            disabled={isPending && isLoading}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              isActive
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Icon className="h-4 w-4 shrink-0" />
            )}
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
