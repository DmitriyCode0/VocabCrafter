import { redirect } from "next/navigation";
import {
  LibraryGrammarBrowser,
  type LibraryGrammarBrowserSection,
} from "@/components/library/library-grammar-browser";
import { LibraryPageHeader } from "@/components/library/library-page-header";
import { createClient } from "@/lib/supabase/server";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { getAppMessages } from "@/lib/i18n/messages";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, app_language")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "tutor" && profile?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const messages = getAppMessages(normalizeAppLanguage(profile.app_language));
  const [englishCatalog, spanishCatalog] = await Promise.all([
    getGrammarTopicPromptCatalog("english"),
    getGrammarTopicPromptCatalog("spanish"),
  ]);

  const languageSections: LibraryGrammarBrowserSection[] = [
    {
      id: "english",
      title: messages.library.englishTopics,
      levels: englishCatalog,
    },
    {
      id: "spanish",
      title: messages.library.spanishTopics,
      levels: spanishCatalog,
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