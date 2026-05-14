"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PassiveVocabularyStudentFilterProps {
  students: Array<{
    id: string;
    label: string;
  }>;
  activeStudentId?: string | null;
}

export function PassiveVocabularyStudentFilter({
  students,
  activeStudentId,
}: PassiveVocabularyStudentFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const resolvedActiveValue = activeStudentId ?? "all";
  const selectedValue =
    isPending && pendingValue !== null ? pendingValue : resolvedActiveValue;

  function handleValueChange(nextValue: string) {
    if (nextValue === resolvedActiveValue) {
      return;
    }

    setPendingValue(nextValue);
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextValue === "all") {
      nextParams.delete("student");
    } else {
      nextParams.set("student", nextValue);
    }

    nextParams.delete("page");

    startTransition(() => {
      router.replace(
        nextParams.size > 0
          ? `${pathname}?${nextParams.toString()}`
          : pathname,
        { scroll: false },
      );
    });
  }

  return (
    <div className="space-y-2">
      <Select value={selectedValue} onValueChange={handleValueChange}>
        <SelectTrigger
          aria-busy={isPending}
          className="w-full md:w-[280px]"
          disabled={isPending}
        >
          <SelectValue placeholder="Choose a student" />
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Choose a student</SelectItem>
          {students.map((student) => (
            <SelectItem key={student.id} value={student.id}>
              {student.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Loading student data...</span>
        </div>
      ) : null}
    </div>
  );
}