"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Save, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { InfoLabel } from "@/components/shared/info-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PLAN_LIMIT_DETAILS,
  PLAN_LIMIT_DETAIL_ORDER,
  PLAN_ORDER,
  buildPlanFeatures,
  fmtLimit,
  type PlanDefinition,
  type PlanKey,
} from "@/lib/plans";
import type { Role } from "@/types/roles";
import { savePlanLimits } from "@/app/(platform)/plans/actions";

interface PlansPageContentProps {
  currentPlanKey: string | null | undefined;
  plans: PlanDefinition[];
  role: Role;
}

interface PlanEditorState {
  price: string;
  aiCallsPerMonth: string;
  reportsPerMonth: string;
  quizzesPerMonth: string;
  attemptsPerMonth: string;
  wordBanks: string;
}

function toPlanEditorState(plan: PlanDefinition): PlanEditorState {
  return {
    price: String(plan.price),
    aiCallsPerMonth: String(plan.aiCallsPerMonth),
    reportsPerMonth: String(plan.reportsPerMonth),
    quizzesPerMonth: Number.isFinite(plan.quizzesPerMonth)
      ? String(plan.quizzesPerMonth)
      : "",
    attemptsPerMonth: Number.isFinite(plan.attemptsPerMonth)
      ? String(plan.attemptsPerMonth)
      : "",
    wordBanks: Number.isFinite(plan.wordBanks) ? String(plan.wordBanks) : "",
  };
}

function parseRequiredNumber(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a whole number of 0 or more`);
  }

  return parsed;
}

function parseOptionalNumber(value: string, label: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return parseRequiredNumber(normalized, label);
}

function getPlanIcon(planKey: PlanKey) {
  if (planKey === "premium") {
    return Crown;
  }

  if (planKey === "pro") {
    return Zap;
  }

  return Sparkles;
}

export function PlansPageContent({
  currentPlanKey,
  plans,
  role,
}: PlansPageContentProps) {
  const router = useRouter();
  const isSuperadmin = role === "superadmin";
  const [isPending, startTransition] = useTransition();
  const [pendingPlanKey, setPendingPlanKey] = useState<PlanKey | null>(null);
  const [plansState, setPlansState] = useState<Record<PlanKey, PlanDefinition>>(
    () =>
      plans.reduce(
        (catalog, plan) => {
          catalog[plan.key] = plan;
          return catalog;
        },
        {} as Record<PlanKey, PlanDefinition>,
      ),
  );
  const [editorState, setEditorState] = useState<
    Record<PlanKey, PlanEditorState>
  >(() =>
    plans.reduce(
      (catalog, plan) => {
        catalog[plan.key] = toPlanEditorState(plan);
        return catalog;
      },
      {} as Record<PlanKey, PlanEditorState>,
    ),
  );

  const orderedPlans = useMemo(
    () => PLAN_ORDER.map((planKey) => plansState[planKey]),
    [plansState],
  );

  function updateField(
    planKey: PlanKey,
    field: keyof PlanEditorState,
    value: string,
  ) {
    setEditorState((current) => ({
      ...current,
      [planKey]: {
        ...current[planKey],
        [field]: value,
      },
    }));
  }

  function handleSave(planKey: PlanKey) {
    const draft = editorState[planKey];
    setPendingPlanKey(planKey);

    startTransition(async () => {
      try {
        const updatedPlan = await savePlanLimits({
          key: planKey,
          price: parseRequiredNumber(draft.price, "Price"),
          aiCallsPerMonth: parseRequiredNumber(
            draft.aiCallsPerMonth,
            "AI calls per month",
          ),
          reportsPerMonth: parseOptionalNumber(
            draft.reportsPerMonth,
            "Reports per month",
          ),
          quizzesPerMonth: parseOptionalNumber(
            draft.quizzesPerMonth,
            "Quizzes per month",
          ),
          attemptsPerMonth: parseOptionalNumber(
            draft.attemptsPerMonth,
            "Attempts per month",
          ),
          wordBanks: parseOptionalNumber(draft.wordBanks, "Word banks"),
        });

        setPlansState((current) => ({
          ...current,
          [planKey]: updatedPlan,
        }));
        setEditorState((current) => ({
          ...current,
          [planKey]: toPlanEditorState(updatedPlan),
        }));
        toast.success(`${updatedPlan.name} plan limits saved`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save plan limits",
        );
      } finally {
        setPendingPlanKey(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="text-muted-foreground">
          Compare plan limits, understand how each quota works, and review what
          counts toward usage.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {orderedPlans.map((plan) => {
          const Icon = getPlanIcon(plan.key);
          const isCurrent = currentPlanKey === plan.key;

          return (
            <Card
              key={plan.key}
              className={
                isCurrent
                  ? "border-primary ring-2 ring-primary/20"
                  : plan.highlighted
                    ? "border-primary/40"
                    : ""
              }
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon
                      className={
                        plan.key === "premium"
                          ? "h-4 w-4 text-yellow-500"
                          : plan.key === "pro"
                            ? "h-4 w-4 text-primary"
                            : "h-4 w-4 text-muted-foreground"
                      }
                    />
                    {plan.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isCurrent && <Badge className="text-xs">Current</Badge>}
                    {plan.highlighted && !isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <div>
                    <span className="text-3xl font-bold">
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        / month
                      </span>
                    )}
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-0 text-sm">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <div>
                    <p className="font-medium">
                      {fmtLimit(plan.aiCallsPerMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label="AI calls"
                        description={PLAN_LIMIT_DETAILS.aiCalls.description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">
                      {fmtLimit(plan.reportsPerMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label="Reports"
                        description={PLAN_LIMIT_DETAILS.reports.description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">
                      {fmtLimit(plan.quizzesPerMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label="Quizzes"
                        description={PLAN_LIMIT_DETAILS.quizzes.description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">
                      {fmtLimit(plan.attemptsPerMonth)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label="Attempts"
                        description={PLAN_LIMIT_DETAILS.attempts.description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{fmtLimit(plan.wordBanks)}</p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label="Word banks"
                        description={PLAN_LIMIT_DETAILS.wordBanks.description}
                      />
                    </p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-muted-foreground">
                  {buildPlanFeatures(plan).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            How Limits Work
          </h2>
          <p className="text-sm text-muted-foreground">
            Hover the info icons on plan cards for quick definitions, or use the
            detailed breakdown below.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {PLAN_LIMIT_DETAIL_ORDER.map((detailKey) => {
            const detail = PLAN_LIMIT_DETAILS[detailKey];

            return (
              <Card key={detailKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <detail.icon className="h-4 w-4 text-primary" />
                    {detail.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{detail.description}</p>
                  {detail.extra && (
                    <p className="text-xs leading-5">{detail.extra}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {isSuperadmin && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Configure Plan Limits
            </h2>
            <p className="text-sm text-muted-foreground">
              Update plan numbers here. Changes affect quota checks, dashboard
              limits, and plan comparison cards.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {orderedPlans.map((plan) => {
              const draft = editorState[plan.key];
              const savingThisPlan = isPending && pendingPlanKey === plan.key;

              return (
                <Card key={`${plan.key}-editor`}>
                  <CardHeader>
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-price`}>
                          Monthly price
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={PLAN_LIMIT_DETAILS.price.description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-price`}
                        type="number"
                        min="0"
                        step="1"
                        value={draft.price}
                        onChange={(event) =>
                          updateField(plan.key, "price", event.target.value)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-ai-calls`}>
                          AI calls / month
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={PLAN_LIMIT_DETAILS.aiCalls.description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-ai-calls`}
                        type="number"
                        min="0"
                        step="1"
                        value={draft.aiCallsPerMonth}
                        onChange={(event) =>
                          updateField(
                            plan.key,
                            "aiCallsPerMonth",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-reports`}>
                          Reports / month
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={PLAN_LIMIT_DETAILS.reports.description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-reports`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0 disables reports"
                        value={draft.reportsPerMonth}
                        onChange={(event) =>
                          updateField(
                            plan.key,
                            "reportsPerMonth",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-quizzes`}>
                          Quizzes / month
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={PLAN_LIMIT_DETAILS.quizzes.description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-quizzes`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Leave blank for unlimited"
                        value={draft.quizzesPerMonth}
                        onChange={(event) =>
                          updateField(
                            plan.key,
                            "quizzesPerMonth",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-attempts`}>
                          Attempts / month
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={PLAN_LIMIT_DETAILS.attempts.description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-attempts`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Leave blank for unlimited"
                        value={draft.attemptsPerMonth}
                        onChange={(event) =>
                          updateField(
                            plan.key,
                            "attemptsPerMonth",
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-word-banks`}>
                          Word banks
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={PLAN_LIMIT_DETAILS.wordBanks.description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-word-banks`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Leave blank for unlimited"
                        value={draft.wordBanks}
                        onChange={(event) =>
                          updateField(plan.key, "wordBanks", event.target.value)
                        }
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Leave quizzes, attempts, or word banks blank to keep them
                      unlimited for this plan. Set reports to 0 to disable
                      report generation.
                    </p>

                    <Button
                      onClick={() => handleSave(plan.key)}
                      disabled={savingThisPlan}
                      className="w-full"
                    >
                      <Save className="h-4 w-4" />
                      {savingThisPlan ? "Saving..." : "Save Limits"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
