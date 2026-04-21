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
import { useAppI18n } from "@/components/providers/app-language-provider";

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
  const { messages } = useAppI18n();
  const [role, setRole] = useState<Role>(currentRole);
  const [isPending, startTransition] = useTransition();
  const roles: { value: Role; label: string }[] = [
    { value: "student", label: messages.adminUsers.roleLabels.student },
    { value: "tutor", label: messages.adminUsers.roleLabels.tutor },
    { value: "superadmin", label: messages.adminUsers.roleLabels.superadmin },
  ];

  if (isSelf) {
    return (
      <Badge variant={BADGE_VARIANT[role]}>
        {roles.find((entry) => entry.value === role)?.label}
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
        toast.success(
          messages.adminUsers.roleUpdated(
            roles.find((entry) => entry.value === newRole)?.label ?? newRole,
          ),
        );
      } catch {
        setRole(previous); // revert
        toast.error(messages.adminUsers.roleUpdateFailed);
      }
    });
  }

  return (
    <Select value={role} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="h-7 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.value} value={r.value} className="text-xs">
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
