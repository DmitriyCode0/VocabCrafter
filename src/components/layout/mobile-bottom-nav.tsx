"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  TrendingUp,
  Zap,
  UserPlus,
  ClipboardList,
  Brain,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/roles";

interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STUDENT_TABS: BottomNavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/lessons", label: "Lessons", icon: CalendarDays },
  { href: "/quizzes", label: "Quizzes", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/mastery", label: "Mastery", icon: Zap },
];

const TUTOR_TABS: BottomNavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/lessons", label: "Lessons", icon: CalendarDays },
  { href: "/students", label: "Students", icon: UserPlus },
  { href: "/quizzes", label: "Quizzes", icon: BookOpen },
  { href: "/assignments", label: "Tasks", icon: ClipboardList },
];

function getTabsForRole(role: Role): BottomNavItem[] {
  if (role === "student") return STUDENT_TABS;
  if (role === "tutor") return TUTOR_TABS;
  return [];
}

interface MobileBottomNavProps {
  role: Role;
}

export function MobileBottomNav({ role }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingHref) return;
    if (pathname === pendingHref || pathname.startsWith(`${pendingHref}/`)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  const tabs = getTabsForRole(role);

  if (tabs.length === 0) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const isPending = pendingHref === tab.href && !isActive;

          const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
            if (
              e.defaultPrevented ||
              e.button !== 0 ||
              e.metaKey ||
              e.ctrlKey ||
              e.shiftKey ||
              e.altKey ||
              isActive
            ) {
              return;
            }
            setPendingHref(tab.href);
          };

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={handleClick}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform",
                    isActive && "scale-110",
                  )}
                />
              )}
              <span className="truncate leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
