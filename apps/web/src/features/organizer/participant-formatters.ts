import type { StaffTraveler } from "./types";

export function formatMoney(amountMinor: number | null, locale: string) {
  return amountMinor === null
    ? "—"
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
      }).format(amountMinor / 100);
}

export function roleTranslationKey(role: StaffTraveler["role"]) {
  return role === "traveler" ? "traveler2" : role;
}
