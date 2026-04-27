"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, Crown, Loader2 } from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type BillingSection = "usage" | "plans";

interface BillingSectionTabsProps {
  currentSection: BillingSection;
  basePath?: string;
}

export function BillingSectionTabs({
  currentSection,
  basePath = "/billing",
}: BillingSectionTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { messages } = useAppI18n();
  const [loadingTab, setLoadingTab] = useState<BillingSection | null>(null);
  const sections = [
    {
      value: "usage",
      href: basePath,
      label: messages.billing.usageTab,
      icon: CreditCard,
    },
    {
      value: "plans",
      href: `${basePath}/plans`,
      label: messages.billing.plansTab,
      icon: Crown,
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
        const queryString = searchParams.toString();
        router.push(queryString ? `${nextSection.href}?${queryString}` : nextSection.href);
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