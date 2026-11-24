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
import {
  CreditCard,
  Crown,
  Languages,
  LogOut,
  Palette,
  Settings,
  Sparkles,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import {
  COLOR_THEMES,
  type ColorThemeId,
  useColorTheme,
} from "@/components/providers/color-theme-provider";
import { useTtsPreference } from "@/components/providers/tts-preference-provider";
import {
  getPlanBadgeClassName,
  getPlanDisplayName,
  normalizePlanKey,
} from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";
import { Badge } from "@/components/ui/badge";

interface UserMenuProps {
  profile: Profile;
}

export function UserMenu({ profile }: UserMenuProps) {
  const router = useRouter();
  const { messages } = useAppI18n();
  const { engine, setEngine } = useTtsPreference();
  const { colorTheme, setColorTheme } = useColorTheme();
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

  const planKey = normalizePlanKey(profile.plan);
  const planName = getPlanDisplayName(planKey);
  const planBadgeClass = getPlanBadgeClassName(planKey);

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
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[11px]">
              {messages.common.roleNames[profile.role as Role]}
            </Badge>
            <Badge
              variant="outline"
              className={cn("gap-1 text-[11px] font-semibold", planBadgeClass)}
            >
              {planKey === "premium" ? (
                <Crown className="h-2.5 w-2.5 shrink-0" />
              ) : null}
              {planName}
            </Badge>
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        id="user-menu-content"
        aria-labelledby="user-menu-trigger"
        align="end"
        className="w-60"
      >
        <DropdownMenuLabel>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">
              {profile.full_name || profile.email}
            </p>
            <Badge
              variant="outline"
              className={cn("shrink-0 gap-1 text-[10px] font-semibold", planBadgeClass)}
            >
              {planKey === "premium" ? (
                <Crown className="h-2.5 w-2.5 shrink-0" />
              ) : null}
              {planName}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {profile.email}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/billing")}>
          <CreditCard className="mr-2 h-4 w-4" />
          {messages.userMenu.membershipBilling}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          {messages.userMenu.settings}
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
        <div
          className="flex items-center justify-between px-2 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn(
                "h-4 w-4 shrink-0",
                engine === "ai" ? "text-primary" : "text-muted-foreground",
              )}
            />
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium">
                {messages.userMenu.aiVoiceToggle}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {engine === "ai"
                  ? messages.userMenu.aiVoiceEnabled
                  : messages.userMenu.browserVoiceDefault}
              </span>
            </div>
          </div>
          <Switch
            checked={engine === "ai"}
            onCheckedChange={(checked) => {
              const next = checked ? "ai" : "browser";
              setEngine(next);
              if (checked) {
                toast.success(messages.userMenu.switchedToAiVoice);
              } else {
                toast.info(messages.userMenu.switchedToBrowserVoice);
              }
            }}
            aria-label={messages.userMenu.aiVoiceToggle}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            {messages.userMenu.colorPalette}
            <span
              className="ml-auto mr-1.5 inline-block h-3 w-3 rounded-full border border-border/80"
              style={{
                backgroundColor:
                  COLOR_THEMES.find((t) => t.id === colorTheme)?.accentHex ??
                  "#4CAF50",
              }}
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuRadioGroup
              value={colorTheme}
              onValueChange={(value) => setColorTheme(value as ColorThemeId)}
            >
              {COLOR_THEMES.map((option) => (
                <DropdownMenuRadioItem
                  key={option.id}
                  value={option.id}
                  onSelect={(event) => event.preventDefault()}
                  className="gap-2"
                >
                  <span
                    className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-white/20 shadow-2xs"
                    style={{
                      background: `linear-gradient(135deg, ${option.surfaceHex} 45%, ${option.accentHex} 45%)`,
                    }}
                  />
                  <span className="truncate">
                    {messages.userMenu.colorPaletteNames[option.id]}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
