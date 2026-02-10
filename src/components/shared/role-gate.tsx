"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { Role, Permission } from "@/types/roles";

interface RoleGateProps {
  children: React.ReactNode;
  role?: Role | Role[];
  permission?: Permission;
  fallback?: React.ReactNode;
}

export function RoleGate({
  children,
  role,
  permission,
  fallback = null,
}: RoleGateProps) {
  const { can, role: currentRole, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!currentRole) return <>{fallback}</>;

  if (role) {
    const allowedRoles = Array.isArray(role) ? role : [role];
    if (!allowedRoles.includes(currentRole)) {
      return <>{fallback}</>;
    }
  }

  if (permission && !can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
