import { z } from "zod";

export const REPORT_LANGUAGE_OPTIONS = [
  { value: "uk", label: "Ukrainian" },
  { value: "en", label: "English" },
] as const;

export const reportLanguageSchema = z.enum(["uk", "en"]);

export type ReportLanguage = z.infer<typeof reportLanguageSchema>;

export function normalizeReportLanguage(value?: string | null): ReportLanguage {
  return value === "en" ? "en" : "uk";
}

export function getReportLanguageLabel(value?: string | null) {
  return normalizeReportLanguage(value) === "en" ? "English" : "Ukrainian";
}

export function getReportLanguageLocale(value?: string | null) {
  return normalizeReportLanguage(value) === "en" ? "en-GB" : "uk-UA";
}

export function getReportLanguagePromptName(value?: string | null) {
  return getReportLanguageLabel(value);
}