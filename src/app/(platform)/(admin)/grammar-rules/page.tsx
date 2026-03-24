import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGrammarTopicPromptCatalog } from "@/lib/grammar/prompt-overrides";
import { GrammarRulesAdmin } from "./grammar-rules-admin";

export const dynamic = "force-dynamic";

export default async function GrammarRulesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const [englishCatalog, spanishCatalog] = await Promise.all([
    getGrammarTopicPromptCatalog("english"),
    getGrammarTopicPromptCatalog("spanish"),
  ]);

  return (
    <GrammarRulesAdmin
      englishCatalog={englishCatalog}
      spanishCatalog={spanishCatalog}
    />
  );
}
