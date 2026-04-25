"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavLinks } from "./nav-links";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "vocab-crafter.sidebar-collapsed";
const SIDEBAR_COLLAPSED_EVENT = "vocab-crafter:sidebar-collapsed-change";

function getSidebarCollapsedSnapshot() {
  try {
    return (
      window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}

function getSidebarCollapsedServerSnapshot() {
  return false;
}

function subscribeToSidebarCollapsed(onStoreChange: () => void) {
  const handleChange = () => onStoreChange();

  window.addEventListener("storage", handleChange);
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, handleChange);
  };
}

interface SidebarProps {
  profile: Profile;
}

export function Sidebar({ profile }: SidebarProps) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );

  function handleCollapsedChange() {
    const next = !collapsed;

    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT));
    } catch {
      // Ignore local storage failures and keep the current sidebar state.
    }
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-sidebar transition-[width] duration-200 ease-out md:flex md:flex-col",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b transition-[padding] duration-200 ease-out",
          collapsed ? "justify-between px-2" : "justify-between px-5",
        )}
      >
        <Link
          href="/dashboard"
          className={cn(
            "flex min-w-0 items-center font-semibold text-lg",
            collapsed ? "gap-0" : "gap-3",
          )}
        >
          <BookOpen className="h-6 w-6 shrink-0 text-primary" />
          <span className={cn("truncate", collapsed && "sr-only")}>
            VocabCrafter 2.0
          </span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={handleCollapsedChange}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div
        className={cn(
          "flex-1 overflow-y-auto py-4 transition-[padding] duration-200 ease-out",
          collapsed ? "px-2" : "px-3",
        )}
      >
        <NavLinks role={profile.role as Role} collapsed={collapsed} />
      </div>
    </aside>
  );
}
