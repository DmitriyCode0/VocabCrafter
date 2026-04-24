import type { ReactNode } from "react";
import { TutorPlansReportsSectionTabs } from "@/components/progress/tutor-plans-reports-section-tabs";

interface TutorPlansReportsPageHeaderProps {
  currentSection: "plans" | "reports";
  basePath: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function TutorPlansReportsPageHeader({
  currentSection,
  basePath,
  title,
  description,
  actions,
}: TutorPlansReportsPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <TutorPlansReportsSectionTabs
        currentSection={currentSection}
        basePath={basePath}
      />
    </div>
  );
}