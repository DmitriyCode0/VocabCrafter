"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClassroomConnectionPickerProps {
  connections: Array<{
    id: string;
    label: string;
  }>;
  activeConnectionId: string;
}

export function ClassroomConnectionPicker({
  connections,
  activeConnectionId,
}: ClassroomConnectionPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleValueChange(nextValue: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("connection", nextValue);
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  return (
    <Select value={activeConnectionId} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full md:w-[320px]">
        <SelectValue placeholder="Choose a classroom" />
      </SelectTrigger>
      <SelectContent>
        {connections.map((connection) => (
          <SelectItem key={connection.id} value={connection.id}>
            {connection.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}