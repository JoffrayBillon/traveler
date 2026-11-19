import { getLocale } from "@traveler/i18n";

export function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase(getLocale())
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}
