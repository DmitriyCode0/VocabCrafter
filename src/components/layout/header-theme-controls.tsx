"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Palette, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COLOR_THEMES,
  type ColorThemeId,
  useColorTheme,
} from "@/components/providers/color-theme-provider";
import { useAppI18n } from "@/components/providers/app-language-provider";

const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function HeaderThemeControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const { appLanguage, messages } = useAppI18n();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const activePalette =
    COLOR_THEMES.find((item) => item.id === colorTheme) ?? COLOR_THEMES[0];
  const isDark = mounted && resolvedTheme === "dark";

  const toggleLabel =
    appLanguage === "uk"
      ? isDark
        ? "Увімкнути світлу тему"
        : "Увімкнути темну тему"
      : isDark
        ? "Switch to light mode"
        : "Switch to dark mode";

  const paletteLabel = `${messages.userMenu.colorPalette}: ${messages.userMenu.colorPaletteNames[colorTheme]}`;

  return (
    <div
      role="group"
      aria-label={messages.settings.appearanceTitle}
      className="inline-flex h-8 items-center gap-0.5 rounded-xl border border-border/70 bg-card/70 p-0.5 shadow-xs"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          aria-label={paletteLabel}
          title={paletteLabel}
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground ${FOCUS_RING_CLASS}`}
        >
          <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 shrink-0 rounded-full border border-border/80"
            style={{
              background: `linear-gradient(135deg, ${activePalette.surfaceHex} 45%, ${activePalette.accentHex} 45%)`,
            }}
          />
          <span className="hidden max-w-[110px] truncate xl:inline">
            {messages.userMenu.colorPaletteNames[colorTheme]}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {messages.userMenu.colorPalette}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={colorTheme}
            onValueChange={(value) => setColorTheme(value as ColorThemeId)}
          >
            {COLOR_THEMES.map((option) => (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                className="gap-2"
              >
                <span
                  aria-hidden="true"
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
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border/60" />

      <button
        type="button"
        disabled={!mounted}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={toggleLabel}
        title={toggleLabel}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground disabled:opacity-50 ${FOCUS_RING_CLASS}`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Sun className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
