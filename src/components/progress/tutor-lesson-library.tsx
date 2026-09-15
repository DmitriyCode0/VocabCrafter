"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Library, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getLessonsByLevel } from "@/lib/lesson-library";

export function TutorLessonLibrary({ studentId }: { studentId: string }) {
  const groups = getLessonsByLevel();
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/tutor/student-lesson-library?studentId=${encodeURIComponent(studentId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load");
        return response.json() as Promise<{ completedLessonKeys: string[] }>;
      })
      .then((result) => {
        if (active) setCompletedKeys(new Set(result.completedLessonKeys));
      })
      .catch(() => {
        if (active) setCompletedKeys(new Set());
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [studentId]);

  async function toggleLesson(key: string, completed: boolean) {
    const previous = completedKeys;
    const next = new Set(previous);
    if (completed) next.add(key); else next.delete(key);
    setCompletedKeys(next);
    setSavingKey(key);
    try {
      const response = await fetch("/api/tutor/student-lesson-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, lessonKey: key, completed }),
      });
      if (!response.ok) throw new Error("Failed to save");
    } catch {
      setCompletedKeys(previous);
    } finally {
      setSavingKey(null);
    }
  }

  const completedCount = completedKeys.size;
  const totalCount = groups.reduce((total, group) => total + group.lessons.length, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Library className="h-5 w-5" /> Lesson library
            </CardTitle>
            <CardDescription>
              Tick the lessons you have already covered with this student.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {completedCount}/{totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading lesson progress...
          </div>
        ) : groups.map(({ level, lessons }) => {
          const completedInLevel = lessons.filter((lesson) => completedKeys.has(lesson.key)).length;
          return (
            <details key={level} className="group rounded-lg border px-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  {level}
                </span>
                <Badge variant={completedInLevel === lessons.length ? "default" : "outline"}>
                  {completedInLevel}/{lessons.length}
                </Badge>
              </summary>
              <div className="grid gap-1 border-t py-2 sm:grid-cols-2">
                {lessons.map((lesson) => {
                  const checked = completedKeys.has(lesson.key);
                  return (
                    <label key={lesson.key} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                      <Checkbox
                        checked={checked}
                        disabled={savingKey === lesson.key}
                        onCheckedChange={(value) => toggleLesson(lesson.key, value === true)}
                        className="mt-0.5"
                      />
                      <span className={checked ? "text-muted-foreground line-through" : ""}>{lesson.title}</span>
                    </label>
                  );
                })}
              </div>
            </details>
          );
        })}
      </CardContent>
    </Card>
  );
}