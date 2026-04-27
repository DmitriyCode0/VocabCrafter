import { redirect } from "next/navigation";

export default async function ReviewPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await _searchParams;
  redirect("/assignments/review");
}
