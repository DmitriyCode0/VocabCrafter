import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CoachingResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student } = await searchParams;
  const params = new URLSearchParams({ tab: "plan" });
  if (student) {
    params.set("student", student);
  }
  redirect(`/results?${params.toString()}`);
}
