import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TutorStudentReportsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
  redirect(
    `/plans-and-reports/reports?student=${encodeURIComponent(studentId)}`,
  );
}