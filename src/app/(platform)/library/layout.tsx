import { requireRole } from "@/lib/rbac/require-role";

export default async function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("tutor", "superadmin");
  return <>{children}</>;
}
