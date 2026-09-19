import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; page?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  redirect(
    query.size > 0
      ? `/passive-vocabulary?${query.toString()}`
      : "/passive-vocabulary",
  );
}
