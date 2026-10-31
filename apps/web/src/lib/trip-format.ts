import type { TripRole } from "../types/profile";

export const roleLabel: Record<TripRole, string> = {
  traveler: "Voyageur",
  companion: "Accompagnateur",
  manager: "Gestionnaire",
};

export const transportLabel: Record<string, string> = {
  train: "Train",
  flight: "Avion",
  none: "Sans transport réservé",
};

export const ticketLabel = {
  outbound: "Aller",
  return: "Retour",
  other: "Document",
};

export function formatDate(value?: string | null) {
  if (!value) return "À confirmer";
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

export function formatJourneyDate(
  dateTime: string | null | undefined,
  departureTime: string | null | undefined,
) {
  if (!dateTime) return formatDate(departureTime);
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(dateTime);
  if (!match) return dateTime;
  const [, year, month, day, storedTime] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(0, 0, 0, 0);
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  return `${dateLabel} · ${departureTime ?? storedTime}`;
}

export function formatBytes(size: number) {
  return `${Math.max(1, Math.round(size / 1024))} Ko`;
}
