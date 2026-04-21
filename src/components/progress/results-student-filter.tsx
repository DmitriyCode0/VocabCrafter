"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  function handleValueChange(nextValue: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("student", nextValue);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <Select value={activeStudentId} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full md:w-[320px]">
        <SelectValue placeholder="Choose a student" />
      </SelectTrigger>
      <SelectContent>
        {students.map((student) => (
          <SelectItem key={student.id} value={student.id}>
            {student.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}