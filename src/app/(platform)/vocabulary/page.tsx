import { PassiveVocabularyPageContent } from "@/app/(platform)/passive-vocabulary/page";

export const dynamic = "force-dynamic";

export default async function VocabularyPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; page?: string; tab?: string }>;
}) {
  return PassiveVocabularyPageContent({ searchParams });
}
