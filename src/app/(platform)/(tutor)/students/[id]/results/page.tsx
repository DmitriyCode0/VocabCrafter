import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TutorStudentResultsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/results?student=${id}`);
}