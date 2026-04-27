"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import { DashboardHowItWorksButton } from "@/components/shared/dashboard-how-it-works";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";

interface HeaderProps {
  profile: Profile;
}

export function Header({ profile }: HeaderProps) {
  const pathname = usePathname();
  const { messages } = useAppI18n();
  const isDashboard = pathname === "/dashboard";

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Mobile sidebar trigger */}
      <Sheet>
        <SheetTrigger asChild aria-controls="mobile-navigation-sheet">
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">{messages.header.toggleMenu}</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          id="mobile-navigation-sheet"
          aria-labelledby="mobile-navigation-sheet-title"
          side="left"
          className="w-64 p-0"
        >
          <SheetTitle id="mobile-navigation-sheet-title" className="sr-only">
            {messages.header.navigation}
          </SheetTitle>
          <div className="flex h-16 items-center border-b px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-semibold"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              <span>VocabCrafter 2.0</span>
            </Link>
          </div>
          <div className="px-3 py-4">
            <NavLinks role={profile.role as Role} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {isDashboard && (
          <DashboardHowItWorksButton
            role={profile.role as Role}
            placement="header"
          />
        )}
        <UserMenu profile={profile} />
      </div>
    </header>
  );
}
