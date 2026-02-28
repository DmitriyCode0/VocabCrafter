import { type Role, type Permission, ROLE_PERMISSIONS } from "@/types/roles";

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function hasAllPermissions(
  role: Role,
  permissions: Permission[],
): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}
