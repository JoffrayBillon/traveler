import { en } from "./en";
import { fr } from "./fr";

export { en, fr };

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

export type TranslationKey = keyof typeof en;

const frenchSourceTextKeys = new Map<string, TranslationKey>(
  Object.entries(fr).map(([key, value]) => [value, key as TranslationKey]),
);

export function getTranslationKeyForFrenchSourceText(value: string) {
  return frenchSourceTextKeys.get(value);
}
