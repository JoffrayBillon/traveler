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

export function formatBytes(size: number) {
  return `${Math.max(1, Math.round(size / 1024))} Ko`;
}
