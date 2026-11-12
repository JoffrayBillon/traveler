import type { TranslationKey } from "@traveler/i18n/resources";
import type { TripRole } from "@traveler/types/profile";

export const roleLabel: Record<TripRole, TranslationKey> = {
  traveler: "traveler",
  companion: "companion",
  manager: "manager",
};

export const transportLabel: Record<string, TranslationKey> = {
  train: "train",
  flight: "plane",
  none: "noTransportBooked",
};

export const ticketLabel: Record<
  "outbound" | "return" | "other",
  TranslationKey
> = {
  outbound: "outbound",
  return: "return",
  other: "document",
};

export function formatDate(
  value?: string | null,
  locale = "fr-FR",
  pendingLabel = locale.startsWith("en") ? "To be confirmed" : "À confirmer",
) {
  if (!value) return pendingLabel;
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function formatJourneyDate(
  dateTime: string | null | undefined,
  departureTime: string | null | undefined,
  locale = "fr-FR",
  pendingLabel = locale.startsWith("en") ? "To be confirmed" : "À confirmer",
) {
  if (!dateTime) return formatDate(departureTime, locale, pendingLabel);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(dateTime);
  if (!match) return dateTime;
  const [, year, month, day, storedTime] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(0, 0, 0, 0);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  return `${dateLabel} · ${departureTime ?? storedTime}`;
}

export function formatBytes(size: number, locale = "fr-FR") {
  return `${Math.max(1, Math.round(size / 1024))} ${locale.startsWith("en") ? "KB" : "Ko"}`;
}
