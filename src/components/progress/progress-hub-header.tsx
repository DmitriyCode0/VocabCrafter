import type { ReactNode } from "react";
import {
  ProgressHubTabs,
  type ProgressHubTabItem,
} from "@/components/progress/progress-hub-tabs";

interface ProgressHubHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
  activeTab: string;
  basePath: string;
  tabs: ProgressHubTabItem[];
  preserveParams?: string[];
}

export function ProgressHubHeader({
  title,
  description,
  actions,
  activeTab,
  basePath,
  tabs,
  preserveParams,
}: ProgressHubHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      <ProgressHubTabs
        activeTab={activeTab}
        basePath={basePath}
        tabs={tabs}
        preserveParams={preserveParams}
      />
    </div>
  );
}
