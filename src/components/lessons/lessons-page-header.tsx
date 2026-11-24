import type { ReactNode } from "react";
import {
  LessonsSectionTabs,
  type LessonsSection,
} from "@/components/lessons/lessons-section-tabs";
import type { Role } from "@/types/roles";

interface LessonsPageHeaderProps {
  role: Role;
  currentSection: LessonsSection;
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
    <div className="flex flex-col gap-4 border-b border-border/50 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <LessonsSectionTabs
          role={role}
          currentSection={currentSection}
          scheduleHref={scheduleHref}
        />
        {actions}
      </div>
    </div>
  );
}
