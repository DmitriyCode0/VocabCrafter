import type { ReactNode } from "react";
import {
  LibrarySectionTabs,
  type LibrarySection,
} from "@/components/library/library-section-tabs";

interface LibraryPageHeaderProps {
  currentSection: LibrarySection;
  title: string;
  description: string;
  actions?: ReactNode;
  basePath?: string;
}

export function LibraryPageHeader({
  currentSection,
  title,
  description,
  actions,
  basePath,
}: LibraryPageHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      <LibrarySectionTabs currentSection={currentSection} basePath={basePath} />
    </div>
  );
}