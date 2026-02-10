"use client";

import { useCallback } from "react";
import { useUser } from "./use-user";
import type { Role, Permission } from "@/types/roles";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "@/lib/rbac/check-permission";

interface UsePermissionsReturn {
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
  role: Role | null;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { profile, isLoading } = useUser();
  const role = (profile?.role as Role) ?? null;

  const can = useCallback(
    (permission: Permission) => {
      if (!role) return false;
      return hasPermission(role, permission);
    },
    [role],
  );

  const canAny = useCallback(
    (permissions: Permission[]) => {
      if (!role) return false;
      return hasAnyPermission(role, permissions);
    },
    [role],
  );

  const canAll = useCallback(
    (permissions: Permission[]) => {
      if (!role) return false;
      return hasAllPermissions(role, permissions);
    },
    [role],
  );

  return { can, canAny, canAll, role, isLoading };
}
