import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/types/database";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { AppLanguageProvider } from "@/components/providers/app-language-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const appLanguage = normalizeAppLanguage(profile.app_language);

  return (
    <AppLanguageProvider appLanguage={appLanguage}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar profile={profile as Profile} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header profile={profile as Profile} />
          <main className="flex-1 overflow-y-auto p-6 animate-page-enter">
            {children}
          </main>
        </div>
      </div>
    </AppLanguageProvider>
  );
}
