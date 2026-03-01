"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { changeUserRole } from "./actions";
import type { Role } from "@/types/roles";

const ROLES: { value: Role; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "tutor", label: "Tutor" },
  { value: "superadmin", label: "Admin" },
];

const BADGE_VARIANT: Record<
  Role,
  "default" | "secondary" | "destructive" | "outline"
> = {
  student: "secondary",
  tutor: "default",
  superadmin: "destructive",
};

interface RoleSelectorProps {
  userId: string;
  currentRole: Role;
  /** Prevent the current user from demoting themselves */
  isSelf: boolean;
}

export function RoleSelector({
  userId,
  currentRole,
  isSelf,
}: RoleSelectorProps) {
  const [role, setRole] = useState<Role>(currentRole);
  const [isPending, startTransition] = useTransition();

  if (isSelf) {
    return (
      <Badge variant={BADGE_VARIANT[role]}>
        {ROLES.find((r) => r.value === role)?.label}
      </Badge>
    );
  }

  function handleChange(value: string) {
    const newRole = value as Role;
    const previous = role;
    setRole(newRole); // optimistic update

    startTransition(async () => {
      try {
        await changeUserRole(userId, newRole);
        toast.success(`Role updated to ${newRole}`);
      } catch {
        setRole(previous); // revert
        toast.error("Failed to update role");
      }
    });
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-7 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r.value} value={r.value} className="text-xs">
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
