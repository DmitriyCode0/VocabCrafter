"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    label: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
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
    label: "Billing",
    href: "/billing",
    icon: CreditCard,
    roles: ["superadmin"],
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
    <nav className="flex flex-col gap-1">
      {filteredItems.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
