type AppDateInput = string | number | Date | null | undefined;

const APP_DATE_LOCALE = "en-GB";

const appDateFormatter = new Intl.DateTimeFormat(APP_DATE_LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const appDateTimeFormatter = new Intl.DateTimeFormat(APP_DATE_LOCALE, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

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

export function formatAppDate(value: AppDateInput) {
  const date = toValidDate(value);
  return date ? appDateFormatter.format(date) : "—";
}

export function formatAppDateTime(value: AppDateInput) {
  const date = toValidDate(value);
  return date ? appDateTimeFormatter.format(date) : "—";
}

export function formatAppMonthName(value: AppDateInput) {
  const date = toValidDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(APP_DATE_LOCALE, {
    month: "long",
  }).format(date);
}