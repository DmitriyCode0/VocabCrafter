"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { runWithThemeTransition } from "@/lib/theme-transition";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  function cycle() {
    const nextTheme =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    const resolvedNext =
      nextTheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : nextTheme;

    runWithThemeTransition(
      () => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedNext);
        setTheme(nextTheme);
      },
      () => {
        document.documentElement.style.colorScheme = resolvedNext;
      },
    );
  }

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cycle}>
      {theme === "dark" && <Moon className="h-4 w-4" />}
      {theme === "light" && <Sun className="h-4 w-4" />}
      {theme === "system" && <Monitor className="h-4 w-4" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
