import type { ReactNode } from "react";
import { TutorProgressSectionTabs } from "@/components/progress/tutor-progress-section-tabs";

interface TutorProgressPageHeaderProps {
  currentSection: "overall" | "monthly";
  basePath: string;
  title?: string;
  description: string;
  actions?: ReactNode;
}

export function TutorProgressPageHeader({
  currentSection,
  basePath,
  title = "Progress",
  description,
  actions,
}: TutorProgressPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <TutorProgressSectionTabs
        currentSection={currentSection}
        basePath={basePath}
      />
    </div>
  );
}