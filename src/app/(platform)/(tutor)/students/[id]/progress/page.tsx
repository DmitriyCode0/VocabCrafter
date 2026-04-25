import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TutorStudentProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;

  redirect(`/results/coaching?student=${encodeURIComponent(studentId)}`);
}
