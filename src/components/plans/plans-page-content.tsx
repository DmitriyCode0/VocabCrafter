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
  type PlanDefinition,
  type PlanKey,
} from "@/lib/plans";
import { useAppI18n } from "@/components/providers/app-language-provider";
import type { AppMessages } from "@/lib/i18n/messages";
import {
  getLocalizedPlanDescription,
  getLocalizedPlanFeatures,
  getLocalizedPlanLimitDetail,
  getLocalizedPlanName,
} from "@/lib/i18n/plans";
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

function parseRequiredNumber(
  value: string,
  label: string,
  messages: AppMessages["plans"]["editor"],
) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(messages.required(label));
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(messages.wholeNumber(label));
  }

  return parsed;
}

function parseOptionalNumber(
  value: string,
  label: string,
  messages: AppMessages["plans"]["editor"],
) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return parseRequiredNumber(normalized, label, messages);
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
  const { messages } = useAppI18n();
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
          price: parseRequiredNumber(
            draft.price,
            messages.plans.editor.monthlyPrice,
            messages.plans.editor,
          ),
          aiCallsPerMonth: parseRequiredNumber(
            draft.aiCallsPerMonth,
            messages.plans.editor.aiCallsPerMonth,
            messages.plans.editor,
          ),
          reportsPerMonth: parseOptionalNumber(
            draft.reportsPerMonth,
            messages.plans.editor.reportsPerMonth,
            messages.plans.editor,
          ),
          quizzesPerMonth: parseOptionalNumber(
            draft.quizzesPerMonth,
            messages.plans.editor.quizzesPerMonth,
            messages.plans.editor,
          ),
          attemptsPerMonth: parseOptionalNumber(
            draft.attemptsPerMonth,
            messages.plans.editor.attemptsPerMonth,
            messages.plans.editor,
          ),
          wordBanks: parseOptionalNumber(
            draft.wordBanks,
            messages.plans.editor.wordBanks,
            messages.plans.editor,
          ),
        });

        setPlansState((current) => ({
          ...current,
          [planKey]: updatedPlan,
        }));
        setEditorState((current) => ({
          ...current,
          [planKey]: toPlanEditorState(updatedPlan),
        }));
        toast.success(
          messages.plans.editor.saved(
            getLocalizedPlanName(messages, updatedPlan.key),
          ),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : messages.plans.editor.saveFailed,
        );
      } finally {
        setPendingPlanKey(null);
      }
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {messages.plans.title}
        </h1>
        <p className="text-muted-foreground">
          {messages.plans.description}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {orderedPlans.map((plan) => {
          const Icon = getPlanIcon(plan.key);
          const isCurrent = currentPlanKey === plan.key;
          const planName = getLocalizedPlanName(messages, plan.key);
          const planDescription = getLocalizedPlanDescription(
            messages,
            plan.key,
          );

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
                    {planName}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <Badge className="text-xs">
                        {messages.plans.currentBadge}
                      </Badge>
                    )}
                    {plan.highlighted && !isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        {messages.plans.popularBadge}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1 pt-1">
                  <div>
                    <span className="text-3xl font-bold">
                      {plan.price === 0
                        ? messages.plans.freePrice
                        : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {" "}
                        {messages.plans.perMonth}
                      </span>
                    )}
                  </div>
                  <CardDescription>{planDescription}</CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 pt-0 text-sm">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <div>
                    <p className="font-medium">{plan.aiCallsPerMonth}</p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label={messages.plans.usageLabels.aiCalls}
                        description={getLocalizedPlanLimitDetail(
                          messages,
                          "aiCalls",
                        ).description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{plan.reportsPerMonth}</p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label={messages.plans.usageLabels.reports}
                        description={getLocalizedPlanLimitDetail(
                          messages,
                          "reports",
                        ).description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{plan.quizzesPerMonth}</p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label={messages.plans.usageLabels.quizzes}
                        description={getLocalizedPlanLimitDetail(
                          messages,
                          "quizzes",
                        ).description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{plan.attemptsPerMonth}</p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label={messages.plans.usageLabels.attempts}
                        description={getLocalizedPlanLimitDetail(
                          messages,
                          "attempts",
                        ).description}
                      />
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">{plan.wordBanks}</p>
                    <p className="text-xs text-muted-foreground">
                      <InfoLabel
                        label={messages.plans.usageLabels.wordBanks}
                        description={getLocalizedPlanLimitDetail(
                          messages,
                          "wordBanks",
                        ).description}
                      />
                    </p>
                  </div>
                </div>

                <ul className="space-y-1.5 text-muted-foreground">
                  {getLocalizedPlanFeatures(messages, plan).map((feature) => (
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
            {messages.plans.howLimitsWorkTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {messages.plans.howLimitsWorkDescription}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {PLAN_LIMIT_DETAIL_ORDER.map((detailKey) => {
            const detail = PLAN_LIMIT_DETAILS[detailKey];
            const localizedDetail = getLocalizedPlanLimitDetail(
              messages,
              detailKey,
            );

            return (
              <Card key={detailKey}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <detail.icon className="h-4 w-4 text-primary" />
                    {localizedDetail.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>{localizedDetail.description}</p>
                  {localizedDetail.extra && (
                    <p className="text-xs leading-5">{localizedDetail.extra}</p>
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
              {messages.plans.editor.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {messages.plans.editor.description}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {orderedPlans.map((plan) => {
              const draft = editorState[plan.key];
              const savingThisPlan = isPending && pendingPlanKey === plan.key;

              return (
                <Card key={`${plan.key}-editor`}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {getLocalizedPlanName(messages, plan.key)}
                    </CardTitle>
                    <CardDescription>
                      {getLocalizedPlanDescription(messages, plan.key)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${plan.key}-price`}>
                          {messages.plans.editor.monthlyPrice}
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={getLocalizedPlanLimitDetail(
                            messages,
                            "price",
                          ).description}
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
                          {messages.plans.editor.aiCallsPerMonth}
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={getLocalizedPlanLimitDetail(
                            messages,
                            "aiCalls",
                          ).description}
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
                          {messages.plans.editor.reportsPerMonth}
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={getLocalizedPlanLimitDetail(
                            messages,
                            "reports",
                          ).description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-reports`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder={messages.plans.editor.reportsPlaceholder}
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
                          {messages.plans.editor.quizzesPerMonth}
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={getLocalizedPlanLimitDetail(
                            messages,
                            "quizzes",
                          ).description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-quizzes`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder={messages.plans.editor.unlimitedPlaceholder}
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
                          {messages.plans.editor.attemptsPerMonth}
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={getLocalizedPlanLimitDetail(
                            messages,
                            "attempts",
                          ).description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-attempts`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder={messages.plans.editor.unlimitedPlaceholder}
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
                          {messages.plans.editor.wordBanks}
                        </Label>
                        <InfoLabel
                          label=""
                          className="[&>span:first-child]:sr-only"
                          description={getLocalizedPlanLimitDetail(
                            messages,
                            "wordBanks",
                          ).description}
                        />
                      </div>
                      <Input
                        id={`${plan.key}-word-banks`}
                        type="number"
                        min="0"
                        step="1"
                        placeholder={messages.plans.editor.unlimitedPlaceholder}
                        value={draft.wordBanks}
                        onChange={(event) =>
                          updateField(plan.key, "wordBanks", event.target.value)
                        }
                      />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {messages.plans.editor.helperText}
                    </p>

                    <Button
                      onClick={() => handleSave(plan.key)}
                      disabled={savingThisPlan}
                      className="w-full"
                    >
                      <Save className="h-4 w-4" />
                      {savingThisPlan
                        ? messages.plans.editor.saving
                        : messages.plans.editor.save}
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
