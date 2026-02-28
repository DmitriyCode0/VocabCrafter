export type Role = "student" | "tutor" | "superadmin";

export type Permission =
  | "quiz:create"
  | "quiz:take"
  | "quiz:view_own"
  | "quiz:view_all"
  | "class:create"
  | "class:join"
  | "class:manage"
  | "assignment:create"
  | "assignment:submit"
  | "feedback:give"
  | "feedback:receive"
  | "analytics:view"
  | "users:manage"
  | "billing:manage";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  student: [
    "quiz:create",
    "quiz:take",
    "quiz:view_own",
    "class:join",
    "assignment:submit",
    "feedback:receive",
  ],
  tutor: [
    "quiz:create",
    "quiz:take",
    "quiz:view_own",
    "class:create",
    "class:manage",
    "assignment:create",
    "feedback:give",
  ],
  superadmin: [
    "quiz:create",
    "quiz:take",
    "quiz:view_own",
    "quiz:view_all",
    "class:create",
    "class:join",
    "class:manage",
    "assignment:create",
    "assignment:submit",
    "feedback:give",
    "feedback:receive",
    "analytics:view",
    "users:manage",
    "billing:manage",
  ],
} as const;

export const ROLES: readonly Role[] = [
  "student",
  "tutor",
  "superadmin",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  tutor: "Tutor",
  superadmin: "Super Admin",
};
