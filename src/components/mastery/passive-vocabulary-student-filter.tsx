"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  function handleValueChange(nextValue: string) {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextValue === "all") {
      nextParams.delete("student");
    } else {
      nextParams.set("student", nextValue);
    }

    nextParams.delete("page");
    router.push(
      nextParams.size > 0
        ? `${pathname}?${nextParams.toString()}`
        : pathname,
    );
  }

  return (
    <Select value={activeStudentId ?? "all"} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full md:w-[280px]">
        <SelectValue placeholder="Choose a student" />
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
  );
}