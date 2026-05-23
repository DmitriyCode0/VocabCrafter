import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CoachingResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student } = await searchParams;
  redirect(student ? `/plans-and-reports?student=${student}` : "/plans-and-reports");
}
