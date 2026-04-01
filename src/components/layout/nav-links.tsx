"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  BookOpen,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/roles";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["student", "tutor", "superadmin"],
  },
  // Student items
  {
    label: "My Quizzes",
    href: "/quizzes",
    icon: BookOpen,
    roles: ["student"],
  },
  {
    label: "My Classes",
    href: "/classes",
    icon: GraduationCap,
    roles: ["student"],
  },
  {
    label: "Assignments",
    href: "/assignments",
    icon: ClipboardList,
    roles: ["student"],
  },
  {
    label: "Progress",
    href: "/progress",
    icon: TrendingUp,
    roles: ["student"],
  },
  {
    label: "Vocab Mastery",
    href: "/vocabulary",
    icon: Zap,
    roles: ["student"],
  },
  {
    label: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    roles: ["student"],
  },
  {
    label: "My Tutors",
    href: "/tutors",
    icon: UserCheck,
    roles: ["student"],
  },
  // Tutor items
  {
    label: "My Quizzes",
    href: "/quizzes",
    icon: BookOpen,
    roles: ["tutor"],
  },
  {
    label: "Classes",
    href: "/classes",
    icon: Users,
    roles: ["tutor"],
  },
  {
    label: "Assignments",
    href: "/assignments",
    icon: ClipboardList,
    roles: ["tutor"],
  },
  {
    label: "Review",
    href: "/review",
    icon: MessageSquare,
    roles: ["tutor"],
  },
  {
    label: "Vocab Mastery",
    href: "/mastery",
    icon: Brain,
    roles: ["tutor"],
  },
  {
    label: "My Students",
    href: "/students",
    icon: UserPlus,
    roles: ["tutor"],
  },
  // Shared items
  {
    label: "History",
    href: "/history",
    icon: History,
    roles: ["student", "tutor", "superadmin"],
  },
  // Admin items
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["superadmin"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["superadmin"],
  },
  {
    label: "Grammar Rules",
    href: "/grammar-rules",
    icon: FileText,
    roles: ["superadmin"],
  },
  {
    label: "Billing",
    href: "/billing",
    icon: CreditCard,
    roles: ["student", "tutor", "superadmin"],
  },
  // Shared
  {
    label: "Settings",
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
            key={item.href + item.label}
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
              {item.label}
            </Link>
          </motion.div>
        );
      })}
    </motion.nav>
  );
}
