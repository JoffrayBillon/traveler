import { en } from "./en";
import { fr } from "./fr";

export { en, fr };

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const;

type Assert<T extends true> = T;
export type TranslationCatalogKeyParity = Assert<
  [
    Exclude<keyof typeof fr, keyof typeof en>,
    Exclude<keyof typeof en, keyof typeof fr>,
  ] extends [never, never]
    ? true
    : false
>;

export type TranslationKey = keyof typeof en;

const translationKeys = new Set<string>(Object.keys(en));

export function getTranslationKey(key: string): TranslationKey | undefined {
  return translationKeys.has(key) ? (key as TranslationKey) : undefined;
}

const frenchSourceTextKeys = new Map<string, TranslationKey>(
  Object.entries(fr).map(([key, value]) => [value, key as TranslationKey]),
);

export function getTranslationKeyForFrenchSourceText(value: string) {
  return frenchSourceTextKeys.get(value);
}
