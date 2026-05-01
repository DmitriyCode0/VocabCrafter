import { requireRole } from "@/lib/rbac/require-role";

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("tutor");
  return <>{children}</>;
}
