"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Zap,
  Brain,
  History,
  UserCheck,
  UserPlus,
  FileText,
  LibraryBig,
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

const NAV_ITEMS: NavItem[] = [
  {
    labelKey: "dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["student", "tutor", "superadmin"],
  },
  // Student items
  {
    labelKey: "myQuizzes",
    href: "/quizzes",
    icon: BookOpen,
    roles: ["student"],
  },
  {
    labelKey: "myClasses",
    href: "/classes",
    icon: GraduationCap,
    roles: ["student"],
  },
  {
    labelKey: "lessons",
    href: "/lessons",
    icon: CalendarDays,
    roles: ["student", "tutor"],
  },
  {
    labelKey: "assignments",
    href: "/assignments",
    icon: ClipboardList,
    roles: ["student"],
  },
  {
    labelKey: "progress",
    href: "/progress",
    icon: TrendingUp,
    roles: ["student"],
  },
  {
    labelKey: "vocabMastery",
    href: "/vocabulary",
    icon: Zap,
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
    icon: BookOpen,
    roles: ["tutor"],
  },
  {
    labelKey: "classes",
    href: "/classes",
    icon: Users,
    roles: ["tutor"],
  },
  {
    labelKey: "assignments",
    href: "/assignments",
    icon: ClipboardList,
    roles: ["tutor"],
  },
  {
    labelKey: "vocabMastery",
    href: "/mastery",
    icon: Brain,
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
    icon: TrendingUp,
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
    href: "/passive-vocabulary",
    icon: BookMarked,
    roles: ["student", "tutor", "superadmin"],
  },
  {
    labelKey: "library",
    href: "/library",
    icon: LibraryBig,
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
    icon: CreditCard,
    roles: ["student", "tutor", "superadmin"],
  },
  // Shared
  {
    labelKey: "settings",
    href: "/settings",
    icon: Settings,
    roles: ["student", "tutor", "superadmin"],
  },
];

interface NavLinksProps {
  role: Role;
  collapsed?: boolean;
}

export function NavLinks({ role, collapsed = false }: NavLinksProps) {
  const pathname = usePathname();
  const { messages } = useAppI18n();

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
          const label = messages.nav[item.labelKey];

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
                    className={cn(
                      "nav-link-animated flex items-center rounded-lg py-3 text-base transition-[padding,justify-content] duration-200 ease-out",
                      collapsed ? "justify-center px-0" : "gap-4 px-4",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-6 w-6 shrink-0" />
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
