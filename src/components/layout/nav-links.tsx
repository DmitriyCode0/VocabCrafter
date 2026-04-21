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
  Crown,
  Settings,
  TrendingUp,
  Zap,
  Brain,
  History,
  UserCheck,
  UserPlus,
  FileText,
  Trophy,
} from "lucide-react";
import { useAppI18n } from "@/components/providers/app-language-provider";
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
    labelKey: "review",
    href: "/review",
    icon: MessageSquare,
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
    labelKey: "results",
    href: "/results",
    icon: Trophy,
    roles: ["tutor"],
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
    labelKey: "plans",
    href: "/plans",
    icon: Crown,
    roles: ["student", "tutor", "superadmin"],
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
}

export function NavLinks({ role }: NavLinksProps) {
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
      {filteredItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <motion.div
            key={item.href + item.labelKey}
            variants={{
              hidden: { opacity: 0, x: -12 },
              visible: { opacity: 1, x: 0 },
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Link
              href={item.href}
              data-active={isActive}
              className={cn(
                "nav-link-animated flex items-center gap-4 rounded-lg px-4 py-3 text-base",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-6 w-6" />
              {messages.nav[item.labelKey]}
            </Link>
          </motion.div>
        );
      })}
    </motion.nav>
  );
}
