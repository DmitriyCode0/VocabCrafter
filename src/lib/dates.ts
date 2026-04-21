import {
  formatDateForAppLanguage,
  formatDateTimeForAppLanguage,
  formatMonthNameForAppLanguage,
} from "./i18n/format";

type AppDateInput = string | number | Date | null | undefined;

export function formatAppDate(value: AppDateInput) {
  return formatDateForAppLanguage("en", value);
}

export function formatAppDateTime(value: AppDateInput) {
  return formatDateTimeForAppLanguage("en", value);
}

export function formatAppMonthName(value: AppDateInput) {
  return formatMonthNameForAppLanguage("en", value);
}
