"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, ChevronDown, ChevronUp, User } from "lucide-react";
import { ACTIVITY_LABELS } from "@/lib/constants";
import type { Role } from "@/types/roles";
import { AttemptDetail } from "./attempt-detail";

interface QuizInfo {
  title?: string;
  type?: string;
  cefr_level?: string;
}

interface StudentInfo {
  full_name?: string | null;
  email?: string;
  avatar_url?: string | null;
}

interface HistoryClientProps {
  role: Role;
  attempts: Record<string, unknown>[];
  students: Record<string, unknown>[];
  userId?: string;
  initialStudentFilter?: string;
}

export function HistoryClient({
  role,
  attempts,
  students,
  userId,
  initialStudentFilter,
}: HistoryClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStudent, setFilterStudent] = useState<string>(
    initialStudentFilter || "all",
  );

  const filtered = attempts.filter((a) => {
    const quiz = a.quizzes as QuizInfo | null;
    if (filterType !== "all" && quiz?.type !== filterType) return false;
    if (filterStudent !== "all" && a.student_id !== filterStudent) return false;
    return true;
  });

  const isTutor = role === "tutor" || role === "superadmin";

  const quizTypes = [
    ...new Set(
      attempts
        .map((a) => (a.quizzes as QuizInfo | null)?.type)
        .filter((t): t is string => !!t),
    ),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isTutor ? "Activity History" : "My History"}
        </h1>
        <p className="text-muted-foreground">
          {isTutor
            ? "View your own and your connected students' quiz attempts."
            : "View all your past quiz attempts and results."}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Quiz type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {quizTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {ACTIVITY_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isTutor && students.length > 0 && (
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {userId && <SelectItem value={userId}>My Attempts</SelectItem>}
              {students.map((s) => (
                <SelectItem
                  key={s.id as string}
                  value={s.id as string}
                >
                  {(s.full_name as string) || (s.email as string)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-sm text-muted-foreground">
          {filtered.length} attempt{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center py-12">
            <History className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <CardTitle className="text-lg">No attempts yet</CardTitle>
            <CardDescription>
              {isTutor
                ? "Your students' quiz attempts will appear here once they complete activities."
                : "Complete quizzes to see your history here."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((attempt) => {
            const quiz = attempt.quizzes as QuizInfo | null;
            const student = attempt.profiles as StudentInfo | null;
            const scored =
              attempt.score != null && attempt.max_score != null;
            const pct = scored
              ? Math.round(
                  (Number(attempt.score) / Number(attempt.max_score)) * 100,
                )
              : null;
            const isExpanded = expandedId === (attempt.id as string);
            const isOwnAttempt =
              userId && (attempt.student_id as string) === userId;

            return (
              <Card key={attempt.id as string}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {isTutor && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                          <User className="h-3.5 w-3.5" />
                          <span className="max-w-[140px] truncate">
                            {isOwnAttempt
                              ? "You"
                              : student?.full_name ||
                                student?.email ||
                                "Unknown"}
                          </span>
                        </div>
                      )}
                      <CardTitle className="text-base truncate">
                        {quiz?.title ?? "Quiz"}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {quiz && (
                        <Badge variant="outline">
                          {ACTIVITY_LABELS[quiz.type ?? ""] || quiz.type}
                        </Badge>
                      )}
                      {quiz?.cefr_level && (
                        <Badge variant="secondary">
                          {quiz.cefr_level}
                        </Badge>
                      )}
                      {pct !== null && (
                        <Badge
                          variant={
                            pct >= 80
                              ? "default"
                              : pct >= 50
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {pct}%
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {new Date(
                        attempt.completed_at as string,
                      ).toLocaleString()}
                      {scored && (
                        <span className="ml-2">
                          Score: {Number(attempt.score)} /{" "}
                          {Number(attempt.max_score)}
                        </span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(
                          isExpanded ? null : (attempt.id as string),
                        )
                      }
                    >
                      {isExpanded ? (
                        <>
                          Hide Details
                          <ChevronUp className="ml-1 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Show Details
                          <ChevronDown className="ml-1 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <AttemptDetail attempt={attempt} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
