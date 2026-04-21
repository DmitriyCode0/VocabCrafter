import { fmtLimit, type PlanDefinition, type PlanKey, type PlanLimitDetailKey } from "@/lib/plans";

import type { AppMessages } from "./messages";

const EXTRA_FEATURE_KEYS: Record<
  PlanKey,
  Array<keyof AppMessages["plans"]["features"]["extra"]>
> = {
  free: ["allQuizTypes", "communitySupport"],
  pro: ["priorityAiGeneration", "detailedAnalytics", "emailSupport"],
  premium: ["customGrammarTopics", "prioritySupport", "earlyAccess"],
};

export function getLocalizedPlanName(
  messages: AppMessages,
  planKey: PlanKey,
) {
  return messages.plans.planNames[planKey];
}

export function getLocalizedPlanDescription(
  messages: AppMessages,
  planKey: PlanKey,
) {
  return messages.plans.planDescriptions[planKey];
}

export function getLocalizedPlanFeatures(
  messages: AppMessages,
  plan: PlanDefinition,
) {
  const features = [
    messages.plans.features.aiCalls(fmtLimit(plan.aiCallsPerMonth)),
  ];

  features.push(
    plan.reportsPerMonth > 0
      ? messages.plans.features.reports(fmtLimit(plan.reportsPerMonth))
      : messages.plans.features.noReports,
  );

  if (
    !Number.isFinite(plan.quizzesPerMonth) &&
    !Number.isFinite(plan.attemptsPerMonth)
  ) {
    features.push(messages.plans.features.unlimitedQuizzesAttempts);
  } else {
    features.push(
      Number.isFinite(plan.quizzesPerMonth)
        ? messages.plans.features.quizzes(fmtLimit(plan.quizzesPerMonth))
        : messages.plans.features.unlimitedQuizzes,
    );
    features.push(
      Number.isFinite(plan.attemptsPerMonth)
        ? messages.plans.features.attempts(fmtLimit(plan.attemptsPerMonth))
        : messages.plans.features.unlimitedAttempts,
    );
  }

  features.push(
    Number.isFinite(plan.wordBanks)
      ? messages.plans.features.wordBanks(fmtLimit(plan.wordBanks))
      : messages.plans.features.unlimitedWordBanks,
  );

  return [
    ...features,
    ...EXTRA_FEATURE_KEYS[plan.key].map(
      (featureKey) => messages.plans.features.extra[featureKey],
    ),
  ];
}

export function getLocalizedPlanLimitDetail(
  messages: AppMessages,
  detailKey: PlanLimitDetailKey,
) {
  return messages.plans.limitDetails[detailKey];
}