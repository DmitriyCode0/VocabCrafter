import { redirect } from "next/navigation";
import {
  LibraryGrammarBrowser,
  type LibraryGrammarBrowserSection,
} from "@/components/library/library-grammar-browser";
import { LibraryPageHeader } from "@/components/library/library-page-header";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";
import { getAuthenticatedUser } from "@/lib/rbac/require-role";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const authenticatedUser = await getAuthenticatedUser();

  if (!authenticatedUser) {
    redirect("/login");
  }

  const { profile } = authenticatedUser;

  if (profile.role !== "tutor" && profile.role !== "superadmin") {
    redirect("/dashboard");
  }

  const messages = getAppMessages(normalizeAppLanguage(profile.app_language));
  const englishCatalog = await getGrammarTopicPromptCatalog("english");

  const languageSections: LibraryGrammarBrowserSection[] = [
    {
      id: "english",
      title: messages.library.englishTopics,
      levels: englishCatalog,
    },
  ];

  return (
    <div className="space-y-6">
      <LibraryPageHeader
        currentSection="grammar"
        title={messages.library.title}
        description={messages.library.grammarDescription}
      />

      <LibraryGrammarBrowser sections={languageSections} />
    </div>
  );
}