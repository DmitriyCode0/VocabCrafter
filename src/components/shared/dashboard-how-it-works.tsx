"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/roles";
import { BookOpenText, Sparkles, X } from "lucide-react";

interface TourStep {
  targetId: string;
  title: string;
  description: string;
  hint?: string;
}

const TOUR_STEPS: Record<Role, TourStep[]> = {
  student: [
    {
      targetId: "student-new-quiz",
      title: "New Quiz",
      description:
        "Open the quiz builder to generate a fresh AI activity set from your vocabulary list.",
    },
    {
      targetId: "student-review-activity",
      title: "Review Activity",
      description:
        "Start a focused review round built from your weakest tracked words.",
    },
    {
      targetId: "student-quizzes-created",
      title: "Quizzes Created",
      description:
        "This mirrors your monthly quiz quota so you can see how many generations remain on your plan.",
    },
    {
      targetId: "student-day-streak",
      title: "Day Streak",
      description:
        "Your streak counts consecutive days with quiz activity and helps you track practice consistency.",
    },
    {
      targetId: "student-total-words",
      title: "Total Words Tracked",
      description:
        "This shows how many vocabulary terms are currently tracked in your learning library.",
    },
  ],
  tutor: [
    {
      targetId: "tutor-new-quiz",
      title: "New Quiz Page",
      description:
        "Create AI-powered quiz sets that you can assign to classes or use for targeted practice.",
    },
    {
      targetId: "tutor-review",
      title: "Review Page",
      description:
        "Inspect student attempts, score open-ended answers, and leave feedback where needed.",
    },
    {
      targetId: "tutor-students",
      title: "Students Page",
      description:
        "Use this page to monitor your student roster and jump into individual learner context faster.",
    },
  ],
  superadmin: [
    {
      targetId: "admin-analytics",
      title: "Analytics Page",
      description:
        "See platform-wide metrics, activity volume, and adoption trends across the product.",
    },
    {
      targetId: "admin-users",
      title: "Users Page",
      description:
        "Manage accounts, roles, and onboarding state from one place.",
    },
  ],
};

function getStorageKey(role: Role) {
  return `dashboard-how-it-works:${role}`;
}

export function DashboardHowItWorksButton({ role }: { role: Role }) {
  const [hasSeen, setHasSeen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const activeStep = steps[stepIndex] ?? null;

  useEffect(() => {
    setIsHydrated(true);

    try {
      setHasSeen(window.localStorage.getItem(getStorageKey(role)) === "1");
    } catch {
      setHasSeen(false);
    }
  }, [role]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !activeStep) {
      return;
    }

    const selector = `[data-tour-id="${activeStep.targetId}"]`;
    const getTarget = () => document.querySelector<HTMLElement>(selector);
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const updateRect = () => {
      const target = getTarget();
      if (!target) {
        setTargetRect(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = 12;

      setTargetRect({
        top: Math.max(8, rect.top - padding),
        left: Math.max(8, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };

    const target = getTarget();
    target?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });

    const frameId = window.requestAnimationFrame(updateRect);
    const timeoutId = window.setTimeout(
      updateRect,
      prefersReducedMotion ? 0 : 220,
    );

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [activeStep, isOpen]);

  function markSeen() {
    setHasSeen(true);

    try {
      window.localStorage.setItem(getStorageKey(role), "1");
    } catch {
      // Ignore storage failures and keep the guide usable.
    }
  }

  function openTour() {
    const availableSteps = TOUR_STEPS[role].filter((step) =>
      document.querySelector(`[data-tour-id="${step.targetId}"]`),
    );

    setSteps(availableSteps.length > 0 ? availableSteps : TOUR_STEPS[role]);
    setStepIndex(0);
    setIsOpen(true);
    markSeen();
  }

  function closeTour() {
    setIsOpen(false);
    setTargetRect(null);
  }

  function goToPreviousStep() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function goToNextStep() {
    if (stepIndex >= steps.length - 1) {
      closeTour();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:items-end">
        <Button
          variant={hasSeen ? "outline" : "default"}
          className="w-full sm:w-auto"
          onClick={openTour}
        >
          <BookOpenText className="h-4 w-4" />
          How It Works
          {!hasSeen && isHydrated && (
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-current">
              New
            </span>
          )}
        </Button>
        {!hasSeen && isHydrated && (
          <p className="text-xs text-muted-foreground sm:text-right">
            One guided walkthrough for this dashboard.
          </p>
        )}
      </div>

      <AnimatePresence>
        {isOpen && activeStep && (
          <motion.div
            className="fixed inset-0 z-[80]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />

            {targetRect && (
              <motion.div
                className="pointer-events-none fixed rounded-[28px] border border-emerald-300/90 bg-transparent shadow-[0_0_0_9999px_rgba(2,6,23,0.58)]"
                initial={false}
                animate={{
                  top: targetRect.top,
                  left: targetRect.left,
                  width: targetRect.width,
                  height: targetRect.height,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-[inherit] ring-2 ring-emerald-100/75"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
                />
              </motion.div>
            )}

            <motion.div
              className="fixed inset-x-4 bottom-4 z-[81] mx-auto max-w-md rounded-3xl border border-border/70 bg-background/95 p-5 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <Badge variant="outline" className="w-fit">
                    Step {stepIndex + 1} of {steps.length}
                  </Badge>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h2 className="text-lg font-semibold tracking-tight">
                        {activeStep.title}
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activeStep.description}
                    </p>
                    {activeStep.hint && (
                      <p className="text-xs text-muted-foreground/80">
                        {activeStep.hint}
                      </p>
                    )}
                  </div>
                </div>

                <Button variant="ghost" size="icon-sm" onClick={closeTour}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close guide</span>
                </Button>
              </div>

              <div className="mt-5 flex items-center gap-1.5">
                {steps.map((step, index) => (
                  <span
                    key={step.targetId}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      index === stepIndex
                        ? "w-7 bg-primary"
                        : "w-1.5 bg-muted-foreground/30",
                    )}
                  />
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={closeTour} className="w-full sm:w-auto">
                    Close
                  </Button>
                  {stepIndex > 0 && (
                    <Button
                      variant="outline"
                      onClick={goToPreviousStep}
                      className="w-full sm:w-auto"
                    >
                      Back
                    </Button>
                  )}
                </div>

                <Button onClick={goToNextStep} className="w-full sm:w-auto">
                  {stepIndex === steps.length - 1 ? "Finish" : "Next"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}