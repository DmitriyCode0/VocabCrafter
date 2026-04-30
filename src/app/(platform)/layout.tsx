import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";
import { normalizeAppLanguage } from "@/lib/i18n/app-language";
import { AppLanguageProvider } from "@/components/providers/app-language-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";

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
      <div className="flex h-dvh overflow-hidden">
        <Sidebar profile={profile as Profile} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header profile={profile as Profile} />
          <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6 animate-page-enter">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav role={profile.role as Role} />
    </AppLanguageProvider>
  );
}
