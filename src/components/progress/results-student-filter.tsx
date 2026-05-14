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

interface ResultsStudentFilterProps {
  students: Array<{
    id: string;
    label: string;
  }>;
  activeStudentId: string;
}

export function ResultsStudentFilter({
  students,
  activeStudentId,
}: ResultsStudentFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedValue =
    isPending && pendingValue !== null ? pendingValue : activeStudentId;

  function handleValueChange(nextValue: string) {
    if (nextValue === activeStudentId) {
      return;
    }

    setPendingValue(nextValue);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("student", nextValue);

    startTransition(() => {
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-2">
      <Select value={selectedValue} onValueChange={handleValueChange}>
        <SelectTrigger
          aria-busy={isPending}
          className="w-full md:w-[320px]"
          disabled={isPending}
        >
          <SelectValue placeholder="Choose a student" />
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </SelectTrigger>
        <SelectContent>
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