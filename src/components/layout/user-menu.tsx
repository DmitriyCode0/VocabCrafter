"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { createClient } from "@/lib/supabase/client";
import { APP_LANGUAGES, normalizeAppLanguage } from "@/lib/i18n/app-language";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, LogOut, Settings, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";
import { Badge } from "@/components/ui/badge";

interface UserMenuProps {
  profile: Profile;
}

export function UserMenu({ profile }: UserMenuProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const supabase = createClient();
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const selectedAppLanguage = normalizeAppLanguage(profile.app_language);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleAppLanguageChange = async (value: string) => {
    const nextAppLanguage = normalizeAppLanguage(value);

    if (isUpdatingLanguage || nextAppLanguage === selectedAppLanguage) {
      return;
    }

    setIsUpdatingLanguage(true);

    const { error } = await supabase
      .from("profiles")
      .update({ app_language: nextAppLanguage })
      .eq("id", profile.id);

    if (error) {
      setIsUpdatingLanguage(false);
      toast.error(messages.userMenu.appLanguageUpdateFailed);
      return;
    }

    setIsUpdatingLanguage(false);
    toast.success(messages.userMenu.appLanguageUpdated);
    router.refresh();
  };

  const initials = profile.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0].toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id="user-menu-trigger"
        className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="hidden text-left md:block">
          <p className="text-sm font-medium leading-none">
            {profile.full_name || profile.email}
          </p>
          <Badge variant="secondary" className="mt-1 text-xs">
            {messages.common.roleNames[profile.role as Role]}
          </Badge>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        id="user-menu-content"
        aria-labelledby="user-menu-trigger"
        align="end"
        className="w-56"
      >
        <DropdownMenuLabel>
          <p className="text-sm font-medium">
            {profile.full_name || profile.email}
          </p>
          <p className="text-xs text-muted-foreground">{profile.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          {messages.userMenu.settings}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/dashboard")}>
          <User className="mr-2 h-4 w-4" />
          {messages.userMenu.profile}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="mr-2 h-4 w-4" />
            {messages.userMenu.appLanguage}
            <span className="ml-auto pr-2 text-xs text-muted-foreground">
              {isUpdatingLanguage
                ? messages.common.saving
                : messages.common.languageNames[selectedAppLanguage]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuRadioGroup
              value={selectedAppLanguage}
              onValueChange={handleAppLanguageChange}
            >
              {APP_LANGUAGES.map((value) => (
                <DropdownMenuRadioItem
                  key={value}
                  value={value}
                  disabled={isUpdatingLanguage}
                >
                  {messages.common.languageNames[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm">{messages.userMenu.theme}</span>
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {messages.userMenu.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
