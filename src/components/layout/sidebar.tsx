"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { NavLinks } from "./nav-links";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";

interface SidebarProps {
  profile: Profile;
}

export function Sidebar({ profile }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 font-semibold text-lg"
        >
          <BookOpen className="h-6 w-6 text-primary" />
          <span>VocabCrafter 2.0</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks role={profile.role as Role} />
      </div>
    </aside>
  );
}
