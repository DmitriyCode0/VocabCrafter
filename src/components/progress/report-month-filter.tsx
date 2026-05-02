"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ReportMonthFilterProps {
  activeMonth: string;
  locale: string;
  monthCountBefore?: number;
  monthCountAfter?: number;
}

function parseMonth(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toMonthKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function addUtcMonths(date: Date, amount: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1),
  );
}

function formatMonthLabel(month: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseMonth(month));
}

export function ReportMonthFilter({
  activeMonth,
  locale,
  monthCountBefore = 12,
  monthCountAfter = 2,
}: ReportMonthFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = useMemo(() => {
    const anchor = parseMonth(activeMonth);
    const next = [] as Array<{ value: string; label: string }>;

    for (let offset = -monthCountBefore; offset <= monthCountAfter; offset += 1) {
      const month = toMonthKey(addUtcMonths(anchor, offset));
      next.push({ value: month, label: formatMonthLabel(month, locale) });
    }

    return next.reverse();
  }, [activeMonth, locale, monthCountAfter, monthCountBefore]);

  function handleValueChange(nextMonth: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("month", nextMonth);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <Select value={activeMonth} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full md:w-[240px]">
        <SelectValue placeholder="Choose month" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
