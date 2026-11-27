import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MonthlyResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const { student } = await searchParams;
  const params = new URLSearchParams({ tab: "overview" });
  if (student) {
    params.set("student", student);
  }
  redirect(`/results?${params.toString()}`);
}
