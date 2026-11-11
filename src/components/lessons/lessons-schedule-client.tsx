"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Users,
} from "lucide-react";
import { CreateLessonDialog } from "@/components/lessons/create-lesson-dialog";
import { GoogleCalendarSyncCard } from "@/components/lessons/google-calendar-sync-card";
import { LessonBalanceManager } from "@/components/lessons/lesson-balance-manager";
import { LessonsPageHeader } from "@/components/lessons/lessons-page-header";
import { MonthlyLessonsCalendar } from "@/components/lessons/monthly-lessons-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatLessonMonthLabel,
  formatLessonMonthParam,
  getLessonMonthRange,
  normalizeLessonMonthParam,
  type LessonBalanceSummaryItem,
  type LessonStudentOption,
  type MonthlyLessonItem,
} from "@/lib/lessons";
import type { Role } from "@/types/roles";

interface GoogleCalendarConnectionStatus {
  googleEmail: string | null;
  calendarId: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

interface LessonsScheduleClientProps {
  role: Role;
  initialMonthParam: string;
  title: string;
  description: string;
  previousLabel: string;
  nextLabel: string;
  allLessons: MonthlyLessonItem[];
  connectedStudents?: LessonStudentOption[];
  googleCalendarAvailable?: boolean;
  googleCalendarConnection?: GoogleCalendarConnectionStatus | null;
  studentTutorCount?: number;
  studentBalanceSummaries?: LessonBalanceSummaryItem[];
}

export function LessonsScheduleClient({
  role,
  initialMonthParam,
  title,
  description,
  previousLabel,
  nextLabel,
  allLessons,
  connectedStudents = [],
  googleCalendarAvailable = false,
  googleCalendarConnection = null,
  studentTutorCount = 0,
  studentBalanceSummaries = [],
}: LessonsScheduleClientProps) {
  const [monthParam, setMonthParam] = useState(initialMonthParam);

  useEffect(() => {
    setMonthParam(initialMonthParam);
  }, [initialMonthParam]);

  const monthDate = useMemo(
    () => normalizeLessonMonthParam(monthParam),
    [monthParam],
  );

  const monthLessons = useMemo(() => {
    const { startIsoDate, endIsoDate } = getLessonMonthRange(monthDate);
    return allLessons.filter(
      (lesson) =>
        lesson.lessonDate >= startIsoDate && lesson.lessonDate <= endIsoDate,
    );
  }, [allLessons, monthDate]);

  function handleStepMonth(offset: number) {
    const nextDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + offset,
      1,
    );
    const nextParam = formatLessonMonthParam(nextDate);
    setMonthParam(nextParam);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/lessons?month=${nextParam}`);
    }
  }

  const scheduleHref = `/lessons?month=${monthParam}`;
  const connectHref = `/api/google-calendar/connect?next=${encodeURIComponent(scheduleHref)}`;

  return (
    <div className="space-y-6">
      <LessonsPageHeader
        role={role}
        currentSection="schedule"
        title={title}
        description={description}
        scheduleHref={scheduleHref}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleStepMonth(-1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {previousLabel}
            </Button>
            <Badge variant="outline" className="h-9 px-4 text-sm">
              {formatLessonMonthLabel(monthDate)}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleStepMonth(1)}
            >
              {nextLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        }
      />

      {role === "student" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Lessons This Month
                </CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{monthLessons.length}</div>
                <p className="text-xs text-muted-foreground">
                  sessions visible in this month view
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Connected Tutors
                </CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{studentTutorCount}</div>
                <p className="text-xs text-muted-foreground">
                  tutors who can schedule lessons for you
                </p>
              </CardContent>
            </Card>
          </div>

          <MonthlyLessonsCalendar
            month={monthDate}
            lessons={monthLessons}
            emptyMessage="No lessons are scheduled in this month yet. Your tutor will add them here."
          />

          {studentBalanceSummaries.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Balances</h2>
                <p className="text-sm text-muted-foreground">
                  See your prepaid balance, lesson price, and how many lessons
                  each tutor balance currently covers.
                </p>
              </div>
              <LessonBalanceManager summaries={studentBalanceSummaries} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tutor Lesson Planner</CardTitle>
                <CardDescription>
                  Add one-time lessons for yourself or lessons for connected
                  students.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {connectedStudents.length} active student
                    {connectedStudents.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <CreateLessonDialog students={connectedStudents} />
              </CardContent>
            </Card>

            <GoogleCalendarSyncCard
              available={googleCalendarAvailable}
              connectHref={connectHref}
              connection={googleCalendarConnection}
            />
          </div>

          <MonthlyLessonsCalendar
            month={monthDate}
            lessons={monthLessons}
            showDailyEarnings
            emptyMessage={
              connectedStudents.length > 0
                ? "No lessons scheduled in this month yet. Add a one-time lesson or one for a connected student."
                : "No lessons scheduled in this month yet. Add a one-time lesson or connect a student."
            }
            canManageLessons
            studentOptions={connectedStudents}
          />
        </div>
      )}
    </div>
  );
}

