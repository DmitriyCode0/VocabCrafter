"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppI18n } from "@/components/providers/app-language-provider";
import type { TutorStudentThreeStateSummary } from "@/components/mastery/tutor-unified-mastery-client";

interface TutorAllStudentsMatrixProps {
  students: TutorStudentThreeStateSummary[];
  selectedStudentId?: string | null;
  preservedMonth?: string | null;
}

export function TutorAllStudentsMatrix({
  students,
  selectedStudentId,
  preservedMonth,
}: TutorAllStudentsMatrixProps) {
  const { messages } = useAppI18n();
  const t = messages.tutorMastery.unified;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t.allStudentsRosterTitle}</CardTitle>
        <CardDescription>{t.allStudentsRosterDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => {
            const isSelected = student.studentId === selectedStudentId;
            const params = new URLSearchParams({
              tab: "overview",
              student: student.studentId,
            });
            if (preservedMonth) {
              params.set("month", preservedMonth);
            }

            return (
              <Link
                key={student.studentId}
                href={`/results?${params.toString()}`}
                className={`group block rounded-xl border p-3.5 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {student.name}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {t.levelProgressionBadge(
                        student.currentCefrLevel,
                        student.nextCefrLevel,
                      )}
                    </Badge>
                  </div>
                  {isSelected ? (
                    <Badge className="bg-primary text-[10px] text-primary-foreground">
                      {t.selectedBadge}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border bg-background/70 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {messages.tutorMastery.levelLabels.learning}
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      {student.learningCount}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/70 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-sky-600 dark:text-sky-400">
                      Passive
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      {student.passiveEquivalentCount}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        (
                        {t.percentToNextLevel(
                          student.passivePercentToNextLevel,
                          student.nextCefrLevel,
                        )}
                        )
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/70 px-2.5 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Active
                    </p>
                    <p className="mt-0.5 text-sm font-bold">
                      {student.activeCount}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        (
                        {t.percentToNextLevel(
                          student.activePercentToNextLevel,
                          student.nextCefrLevel,
                        )}
                        )
                      </span>
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
