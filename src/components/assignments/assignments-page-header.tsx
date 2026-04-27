import type { ReactNode } from "react";
import {
  AssignmentsSectionTabs,
  type AssignmentsSection,
} from "@/components/assignments/assignments-section-tabs";
import type { Role } from "@/types/roles";

interface AssignmentsPageHeaderProps {
  role: Role;
  currentSection: AssignmentsSection;
  title?: string;
  description: string;
  actions?: ReactNode;
  basePath?: string;
}

export function AssignmentsPageHeader({
  role,
  currentSection,
  title = "Assignments",
  description,
  actions,
  basePath,
}: AssignmentsPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {role !== "student" ? (
        <AssignmentsSectionTabs
          currentSection={currentSection}
          basePath={basePath}
        />
      ) : null}
    </div>
  );
}