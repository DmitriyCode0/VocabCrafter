import { requireRole } from "@/lib/rbac/require-role";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("superadmin");
  return <>{children}</>;
}
