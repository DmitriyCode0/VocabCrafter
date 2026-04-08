import type { ReactNode } from "react";
import { LessonsSectionTabs } from "@/components/lessons/lessons-section-tabs";
import type { Role } from "@/types/roles";

interface LessonsPageHeaderProps {
  role: Role;
  currentSection: "schedule" | "performance";
  title?: string;
  description: string;
  actions?: ReactNode;
  scheduleHref?: string;
}

export function LessonsPageHeader({
  role,
  currentSection,
  title = "Lessons",
  description,
  actions,
  scheduleHref,
}: LessonsPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {role === "tutor" ? (
        <LessonsSectionTabs
          currentSection={currentSection}
          scheduleHref={scheduleHref}
        />
      ) : null}
    </div>
  );
}