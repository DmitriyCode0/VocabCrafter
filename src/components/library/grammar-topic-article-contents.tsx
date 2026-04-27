"use client";

import { ChevronRight } from "lucide-react";

interface GrammarTopicArticleContentsProps {
  sections: {
    id: string;
    label: string;
  }[];
}

export function GrammarTopicArticleContents({
  sections,
}: GrammarTopicArticleContentsProps) {
  function handleSectionClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) {
    const target = document.getElementById(sectionId);

    if (!target) {
      return;
    }

    event.preventDefault();

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });

    window.history.replaceState(null, "", `#${sectionId}`);
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          onClick={(event) => handleSectionClick(event, section.id)}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
        >
          <span>{section.label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}