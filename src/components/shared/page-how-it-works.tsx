"use client";

import { BookOpenText, CircleHelp } from "lucide-react";
import { usePathname } from "next/navigation";
import { DashboardHowItWorksButton } from "@/components/shared/dashboard-how-it-works";
import { useAppI18n } from "@/components/providers/app-language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CEFR_GUIDED_HOURS,
  CEFR_GUIDED_HOURS_SOURCE,
  CEFR_LEVELS,
} from "@/lib/progress/cefr-guided-hours";
import type { Role } from "@/types/roles";

function formatHourRange(minHours: number, maxHours: number) {
  return `${minHours}-${maxHours} h`;
}

function matchesProgressPath(pathname: string) {
  return (
    pathname === "/progress" ||
    pathname.startsWith("/progress/") ||
    pathname.startsWith("/results") ||
    pathname.endsWith("/progress") ||
    pathname.includes("/progress/")
  );
}

export function PageHowItWorksButton({ role }: { role: Role }) {
  const pathname = usePathname();
  const { appLanguage, messages } = useAppI18n();

  if (pathname === "/dashboard") {
    return <DashboardHowItWorksButton role={role} placement="header" />;
  }

  const isProgressPage = matchesProgressPath(pathname);
  const progressTitle =
    appLanguage === "uk" ? "Як працює прогрес" : "How Progress Works";
  const progressDescription =
    appLanguage === "uk"
      ? "Ця сторінка об'єднує зафіксований час навчання, завершені уроки, словникові сигнали та покриття граматики в один огляд."
      : "This page combines tracked learning time, completed lessons, vocabulary signals, and grammar coverage into one view.";
  const progressAlertTitle =
    appLanguage === "uk"
      ? "Рівні CEFR і guided hours"
      : "CEFR levels and guided hours";
  const progressAlertFollowUp =
    appLanguage === "uk"
      ? "Cambridge English також зазначає, що перехід між сусідніми рівнями CEFR часто потребує приблизно 200 guided hours, але реальний прогрес залежить від інтенсивності навчання, попереднього досвіду та практики поза уроками."
      : "Cambridge English also notes that moving from one CEFR band to the next often takes roughly 200 guided hours, but real progress depends on study intensity, previous exposure, and learning outside lessons.";
  const placeholderTitle =
    appLanguage === "uk" ? "Як це працює" : "How It Works";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm">
          <BookOpenText className="h-4 w-4" />
          {messages.dashboard.guide.buttonLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>
              {isProgressPage ? progressTitle : placeholderTitle}
            </SheetTitle>
            {isProgressPage ? <Badge variant="secondary">Progress</Badge> : null}
          </div>
          {isProgressPage ? (
            <SheetDescription>{progressDescription}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {isProgressPage ? (
            <Alert className="border-primary/20 bg-primary/5">
              <CircleHelp className="text-primary" />
              <AlertTitle>{progressAlertTitle}</AlertTitle>
              <AlertDescription className="gap-3">
                <p>{CEFR_GUIDED_HOURS_SOURCE}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CEFR_LEVELS.map((level) => (
                    <div
                      key={level}
                      className="rounded-lg border border-border/60 bg-background/80 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{level}</span>
                        <span className="text-xs text-muted-foreground">
                          about {CEFR_GUIDED_HOURS[level].averageHours} h
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-foreground">
                        {formatHourRange(
                          CEFR_GUIDED_HOURS[level].minHours,
                          CEFR_GUIDED_HOURS[level].maxHours,
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                <p>{progressAlertFollowUp}</p>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="min-h-24" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}