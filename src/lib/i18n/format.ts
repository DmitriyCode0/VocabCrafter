import { normalizeAppLanguage } from "./app-language";

type AppDateInput = string | number | Date | null | undefined;

interface PluralForms {
  one: string;
  few?: string;
  many?: string;
  other?: string;
}

function toValidDate(value: AppDateInput) {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function getAppLocale(appLanguage: unknown) {
  return normalizeAppLanguage(appLanguage) === "uk" ? "uk-UA" : "en-GB";
}

export function formatDateForAppLanguage(
  appLanguage: unknown,
  value: AppDateInput,
  options?: Intl.DateTimeFormatOptions,
) {
  const date = toValidDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    getAppLocale(appLanguage),
    options ?? {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  ).format(date);
}

export function formatDateTimeForAppLanguage(
  appLanguage: unknown,
  value: AppDateInput,
) {
  return formatDateForAppLanguage(appLanguage, value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatMonthNameForAppLanguage(
  appLanguage: unknown,
  value: AppDateInput,
) {
  return formatDateForAppLanguage(appLanguage, value, {
    month: "long",
  });
}

export function getPluralWord(
  appLanguage: unknown,
  count: number,
  forms: PluralForms,
) {
  const category = new Intl.PluralRules(getAppLocale(appLanguage)).select(
    Math.abs(count),
  );

  if (category === "one") {
    return forms.one;
  }

  if (category === "few") {
    return forms.few ?? forms.other ?? forms.many ?? forms.one;
  }

  if (category === "many") {
    return forms.many ?? forms.other ?? forms.few ?? forms.one;
  }

  return forms.other ?? forms.many ?? forms.few ?? forms.one;
}

export function formatPluralizedCount(
  appLanguage: unknown,
  count: number,
  forms: PluralForms,
) {
  return `${count} ${getPluralWord(appLanguage, count, forms)}`;
}