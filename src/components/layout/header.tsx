"use client";

import Link from "next/link";
import { BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavLinks } from "./nav-links";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/types/database";
import type { Role } from "@/types/roles";

interface HeaderProps {
  profile: Profile;
}

export function Header({ profile }: HeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:px-6">
      {/* Mobile sidebar trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center border-b px-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-semibold"
            >
              <BookOpen className="h-5 w-5 text-primary" />
              <span>VocabCrafter</span>
            </Link>
          </div>
          <div className="px-3 py-4">
            <NavLinks role={profile.role as Role} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <UserMenu profile={profile} />
    </header>
  );
}
