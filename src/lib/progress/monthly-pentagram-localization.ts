type MonthlyPentagramLanguage = "en" | "uk";

export type MonthlyPentagramAxisKey =
  | "active_vocab"
  | "grammar_variety"
  | "engagement"
  | "accuracy"
  | "passive_vocab";

export interface MonthlyPentagramAxis {
  key: MonthlyPentagramAxisKey;
  label: string;
  shortLabel: string;
  score: number;
  value: string;
  helper: string;
  beta?: boolean;
}

export interface MonthlyPentagramChartDatum {
  axis: string;
  score: number;
  fullMark: number;
}

export interface MonthlyPentagramMonth {
  reportMonth: string;
  axes: MonthlyPentagramAxis[];
  chartData: MonthlyPentagramChartDatum[];
}

export interface MonthlyPentagramSnapshot {
  currentMonth: MonthlyPentagramMonth;
  previousMonth: MonthlyPentagramMonth;
}

const MONTHLY_PENTAGRAM_AXIS_COPY: Record<
  MonthlyPentagramLanguage,
  Record<
    MonthlyPentagramAxisKey,
    {
      label: string;
      shortLabel: string;
    }
  >
> = {
  en: {
    active_vocab: { label: "Speaking", shortLabel: "Speaking" },
    grammar_variety: {
      label: "Grammar Variety",
      shortLabel: "Grammar",
    },
    engagement: { label: "Engagement", shortLabel: "Engagement" },
    accuracy: { label: "Accuracy", shortLabel: "Accuracy" },
    passive_vocab: { label: "Vocabulary", shortLabel: "Vocab" },
  },
  uk: {
    active_vocab: { label: "Говоріння", shortLabel: "Говоріння" },
    grammar_variety: {
      label: "Граматична різноманітність",
      shortLabel: "Граматика",
    },
    engagement: { label: "Залученість", shortLabel: "Залученість" },
    accuracy: { label: "Точність", shortLabel: "Точність" },
    passive_vocab: {
      label: "Словниковий запас",
      shortLabel: "Лексика",
    },
  },
};

const MONTHLY_PENTAGRAM_UI_COPY: Record<
  MonthlyPentagramLanguage,
  {
    betaLabel: string;
    grammarNoteLabel: string;
    grammarNotice: string;
  }
> = {
  en: {
    betaLabel: "Beta",
    grammarNoteLabel: "Grammar note.",
    grammarNotice:
      "Grammar variety is month-scoped here and reflects confident grammar-topic coverage inside the reporting window rather than cumulative lifetime grammar coverage.",
  },
  uk: {
    betaLabel: "Бета",
    grammarNoteLabel: "Примітка щодо граматики.",
    grammarNotice:
      "Тут граматична різноманітність прив'язана саме до цього місяця й відображає впевнене покриття граматичних тем у межах звітного вікна, а не накопичене за весь час знання граматики.",
  },
};

function resolveMonthlyPentagramLanguage(
  localeOrLanguage?: string | null,
): MonthlyPentagramLanguage {
  if (!localeOrLanguage) {
    return "en";
  }

  const normalized = localeOrLanguage.toLowerCase();
  return normalized === "uk" || normalized.startsWith("uk-") ? "uk" : "en";
}

function parseNumericToken(token: string) {
  const normalized = token.replace(/,/g, "").trim();
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function formatLocalizedNumber(
  value: number,
  language: MonthlyPentagramLanguage,
  maximumFractionDigits = 1,
) {
  return new Intl.NumberFormat(language === "uk" ? "uk-UA" : "en-GB", {
    maximumFractionDigits,
  }).format(value);
}

function formatLocalizedIntegerToken(
  token: string,
  language: MonthlyPentagramLanguage,
) {
  const value = parseNumericToken(token);
  return value == null ? token : formatLocalizedNumber(value, language, 0);
}

function formatLocalizedPercentToken(
  token: string,
  language: MonthlyPentagramLanguage,
) {
  if (token === "n/a") {
    return language === "uk" ? "н/д" : token;
  }

  const value = parseNumericToken(token.replace(/%$/, ""));
  return value == null
    ? token
    : `${formatLocalizedNumber(value, language, 1)}%`;
}

function localizeAxisValue(
  axis: MonthlyPentagramAxis,
  language: MonthlyPentagramLanguage,
) {
  if (language === "en") {
    return axis.value;
  }

  switch (axis.key) {
    case "active_vocab": {
      const match = axis.value.match(/^(.+?) \/ ([\d.,]+)% speaking target$/);
      if (!match) {
        return axis.value;
      }

      return `${formatLocalizedPercentToken(match[1], language)} / ${formatLocalizedPercentToken(`${match[2]}%`, language)} ціль говоріння`;
    }

    case "grammar_variety": {
      const match = axis.value.match(
        /^Completed selected grammar quizzes: ([\d,]+)\/([\d,]+)$/,
      );
      if (!match) {
        return axis.value;
      }

      return `Виконано вибраних граматичних вікторин: ${formatLocalizedIntegerToken(match[1], language)}/${formatLocalizedIntegerToken(match[2], language)}`;
    }

    case "engagement": {
      const match = axis.value.match(
        /^([\d,]+)\/([\d,]+) active days this month, ([\d,]+)\/([\d,]+) objective completions$/,
      );
      if (!match) {
        return axis.value;
      }

      return `${formatLocalizedIntegerToken(match[1], language)}/${formatLocalizedIntegerToken(match[2], language)} активних днів цього місяця, ${formatLocalizedIntegerToken(match[3], language)}/${formatLocalizedIntegerToken(match[4], language)} виконаних цілей`;
    }

    case "accuracy": {
      const match = axis.value.match(/^([\d.,]+)% average score$/);
      if (!match) {
        return axis.value;
      }

      return `${formatLocalizedPercentToken(`${match[1]}%`, language)} середній бал`;
    }

    case "passive_vocab": {
      const match = axis.value.match(
        /^([\d,]+)\/([\d,]+) words added, ([\d,]+)\/([\d,]+) mastered to level 4-5$/,
      );
      if (!match) {
        return axis.value;
      }

      return `${formatLocalizedIntegerToken(match[1], language)}/${formatLocalizedIntegerToken(match[2], language)} доданих слів, ${formatLocalizedIntegerToken(match[3], language)}/${formatLocalizedIntegerToken(match[4], language)} доведено до рівнів 4-5`;
    }
  }
}

function localizeAxisHelper(
  axis: MonthlyPentagramAxis,
  language: MonthlyPentagramLanguage,
) {
  if (language === "en") {
    return axis.helper;
  }

  switch (axis.key) {
    case "active_vocab":
      return "Місячний бал відображає частку мовлення студента відносно цілі говоріння з місячного плану.";

    case "grammar_variety": {
      const match = axis.helper.match(
        /^Remaining auto-complete quizzes: ([\d,]+)\/([\d,]+)\. ([\d,]+)\/([\d,]+) topics mastered this month\. A topic is mastered after 5 translation quizzes scored 90%\+\.$/,
      );
      if (!match) {
        return axis.helper;
      }

      return `Залишилося автовиконуваних вікторин: ${formatLocalizedIntegerToken(match[1], language)}/${formatLocalizedIntegerToken(match[2], language)}. ${formatLocalizedIntegerToken(match[3], language)}/${formatLocalizedIntegerToken(match[4], language)} тем опановано цього місяця. Тема вважається опанованою після 5 перекладних вікторин із результатом 90%+.`;
    }

    case "engagement":
      return "50% активних днів у застосунку цього місяця, 50% прогресу за виконанням цілей.";

    case "accuracy": {
      const match = axis.helper.match(
        /^([\d,]+) scored gap-fill and translation attempts in the month window\.$/,
      );
      if (!match) {
        return axis.helper;
      }

      return `${formatLocalizedIntegerToken(match[1], language)} оцінених вправ на заповнення пропусків і перекладних спроб у межах місяця.`;
    }

    case "passive_vocab":
      return "Місячний словниковий бал = 30% доданих слів відносно цілі та 70% слів, що досягли рівнів 4-5, відносно цілі.";
  }
}

function localizeMonthlyPentagramMonth(
  month: MonthlyPentagramMonth,
  language: MonthlyPentagramLanguage,
): MonthlyPentagramMonth {
  const axes = month.axes.map((axis) => ({
    ...axis,
    label: MONTHLY_PENTAGRAM_AXIS_COPY[language][axis.key].label,
    shortLabel: MONTHLY_PENTAGRAM_AXIS_COPY[language][axis.key].shortLabel,
    value: localizeAxisValue(axis, language),
    helper: localizeAxisHelper(axis, language),
  }));

  const chartData = month.chartData.map((item, index) => ({
    ...item,
    axis: axes[index]?.shortLabel ?? item.axis,
  }));

  return {
    ...month,
    axes,
    chartData,
  };
}

export function getMonthlyPentagramUiCopy(localeOrLanguage?: string | null) {
  return MONTHLY_PENTAGRAM_UI_COPY[
    resolveMonthlyPentagramLanguage(localeOrLanguage)
  ];
}

export function localizeMonthlyReportPentagramSnapshot(
  snapshot: MonthlyPentagramSnapshot,
  localeOrLanguage?: string | null,
): MonthlyPentagramSnapshot {
  const language = resolveMonthlyPentagramLanguage(localeOrLanguage);

  return {
    currentMonth: localizeMonthlyPentagramMonth(snapshot.currentMonth, language),
    previousMonth: localizeMonthlyPentagramMonth(
      snapshot.previousMonth,
      language,
    ),
  };
}