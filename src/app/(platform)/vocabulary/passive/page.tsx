import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function buildRedirectPath(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
) {
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      nextParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        nextParams.append(key, item);
      }
    }
  }

  nextParams.delete("tab");

  return nextParams.size > 0
    ? `${pathname}?${nextParams.toString()}`
    : pathname;
}

export default async function VocabularyPassivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(buildRedirectPath("/vocabulary", await searchParams));
}
