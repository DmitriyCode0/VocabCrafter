"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState, type MouseEvent } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  CalendarDays,
  GraduationCap,
  Users,
  ClipboardList,
  MessageSquare,
  BarChart3,
  CreditCard,
  Settings,
  TrendingUp,
  Brain,
  History,
  UserCheck,
  UserPlus,
  FileText,
  LibraryBig,
  Loader2,
} from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AppMessages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/roles";

interface NavItem {
  labelKey: keyof AppMessages["nav"];
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const SHARED_PAGE_ICONS = {
  dashboard: LayoutDashboard,
  quizzes: BookOpen,
  classes: GraduationCap,
  lessons: CalendarDays,
  assignments: ClipboardList,
  mastery: Brain,
  progress: TrendingUp,
  vocabulary: BookMarked,
  library: LibraryBig,
  billing: CreditCard,
  settings: Settings,
} as const;

const NAV_ITEMS: NavItem[] = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: SHARED_PAGE_ICONS.dashboard,
    roles: ["student", "tutor", "superadmin"],
  },
  // Student items
  {
    labelKey: "myQuizzes",
    href: "/quizzes",
    icon: SHARED_PAGE_ICONS.quizzes,
    roles: ["student"],
  },
  {
    labelKey: "myClasses",
    href: "/classes",
    icon: SHARED_PAGE_ICONS.classes,
    roles: ["student"],
  },
  {
    labelKey: "lessons",
    href: "/lessons",
    icon: SHARED_PAGE_ICONS.lessons,
    roles: ["student", "tutor"],
  },
  {
    labelKey: "assignments",
    href: "/assignments",
    icon: SHARED_PAGE_ICONS.assignments,
    roles: ["student"],
  },
  {
    labelKey: "progress",
    href: "/progress",
    icon: SHARED_PAGE_ICONS.progress,
    roles: ["student"],
  },
  {
    labelKey: "vocabMastery",
    href: "/mastery",
    icon: SHARED_PAGE_ICONS.mastery,
    roles: ["student"],
  },
  {
    labelKey: "feedback",
    href: "/feedback",
    icon: MessageSquare,
    roles: ["student"],
  },
  {
    labelKey: "myTutors",
    href: "/tutors",
    icon: UserCheck,
    roles: ["student"],
  },
  // Tutor items
  {
    labelKey: "myQuizzes",
    href: "/quizzes",
    icon: SHARED_PAGE_ICONS.quizzes,
    roles: ["tutor"],
  },
  {
    labelKey: "classes",
    href: "/classes",
    icon: SHARED_PAGE_ICONS.classes,
    roles: ["tutor"],
  },
  {
    labelKey: "assignments",
    href: "/assignments",
    icon: SHARED_PAGE_ICONS.assignments,
    roles: ["tutor"],
  },
  {
    labelKey: "vocabMastery",
    href: "/mastery",
    icon: SHARED_PAGE_ICONS.mastery,
    roles: ["tutor"],
  },
  {
    labelKey: "myStudents",
    href: "/students",
    icon: UserPlus,
    roles: ["tutor"],
  },
  {
    labelKey: "progress",
    href: "/results",
    icon: SHARED_PAGE_ICONS.progress,
    roles: ["tutor"],
  },
  {
    labelKey: "plansAndReports",
    href: "/plans-and-reports",
    icon: FileText,
    roles: ["student", "tutor"],
  },
  // Shared items
  {
    labelKey: "history",
    href: "/history",
    icon: History,
    roles: ["student", "tutor"],
  },
  {
    labelKey: "passiveVocabulary",
    href: "/vocabulary",
    icon: SHARED_PAGE_ICONS.vocabulary,
    roles: ["student", "tutor", "superadmin"],
  },
  {
    labelKey: "library",
    href: "/library",
    icon: SHARED_PAGE_ICONS.library,
    roles: ["tutor", "superadmin"],
  },
  // Admin items
  {
    labelKey: "analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["superadmin"],
  },
  {
    labelKey: "users",
    href: "/users",
    icon: Users,
    roles: ["superadmin"],
  },
  {
    labelKey: "grammarRules",
    href: "/grammar-rules",
    icon: FileText,
    roles: ["superadmin"],
  },
  {
    labelKey: "billing",
    href: "/billing",
    icon: SHARED_PAGE_ICONS.billing,
    roles: ["student", "tutor", "superadmin"],
  },
  // Shared
  {
    labelKey: "settings",
    href: "/settings",
    icon: SHARED_PAGE_ICONS.settings,
    roles: ["student", "tutor", "superadmin"],
  },
];

interface NavLinksProps {
  role: Role;
  collapsed?: boolean;
}

export function NavLinks({ role, collapsed = false }: NavLinksProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { messages } = useAppI18n();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const clearPendingHrefForPath = useEffectEvent((nextPathname: string) => {
    setPendingHref((currentPendingHref) => {
      if (!currentPendingHref) {
        return null;
      }

      return nextPathname === currentPendingHref ||
        nextPathname.startsWith(`${currentPendingHref}/`)
        ? null
        : currentPendingHref;
    });
  });

  useEffect(() => {
    clearPendingHrefForPath(pathname);
  }, [pathname]);

  const filteredItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <motion.nav
      className="flex flex-col gap-1"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.04 } },
      }}
    >
      <TooltipProvider>
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isPending = pendingHref === item.href && !isActive;
          const label = messages.nav[item.labelKey];

          const handleMouseEnter = () => {
            router.prefetch(item.href);
          };

          const handleLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
            if (
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              isActive
            ) {
              return;
            }

            setPendingHref(item.href);
          };

          return (
            <motion.div
              key={item.href + item.labelKey}
              variants={{
                hidden: { opacity: 0, x: -12 },
                visible: { opacity: 1, x: 0 },
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    data-active={isActive}
                    data-pending={isPending}
                    onMouseEnter={handleMouseEnter}
                    onClick={handleLinkClick}
                    className={cn(
                      "nav-link-animated flex items-center rounded-lg py-3 text-base transition-[padding,justify-content,opacity] duration-200 ease-out",
                      collapsed ? "justify-center px-0" : "gap-4 px-4",
                      isPending && "animate-pulse opacity-90",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="h-6 w-6 shrink-0 animate-spin" />
                    ) : (
                      <item.icon className="h-6 w-6 shrink-0" />
                    )}
                    <span className={cn("truncate", collapsed && "sr-only")}>
                      {label}
                    </span>
                  </Link>
                </TooltipTrigger>
                {collapsed ? (
                  <TooltipContent side="right">{label}</TooltipContent>
                ) : null}
              </Tooltip>
            </motion.div>
          );
        })}
      </TooltipProvider>
    </motion.nav>
  );
}
