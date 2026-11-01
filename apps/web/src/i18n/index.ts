import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

const languageStorageKey = "traveler-language";
function readSavedLanguage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(languageStorageKey);
  } catch {
    return null;
  }
}

const savedLanguage = readSavedLanguage();
const initialLanguage = savedLanguage === "en" ? "en" : "fr";

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "fr",
  defaultNS: "translation",
  keySeparator: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function setDocumentLanguage(language: string) {
  const supportedLanguage = language.startsWith("en") ? "en" : "fr";
  document.documentElement.lang = supportedLanguage;
  try {
    window.localStorage.setItem(languageStorageKey, supportedLanguage);
  } catch {
    // The current language still applies for this session if storage is blocked.
  }
}

if (typeof document !== "undefined") {
  setDocumentLanguage(initialLanguage);
  i18n.on("languageChanged", setDocumentLanguage);
}

export function getLocale() {
  return i18n.resolvedLanguage === "en" ? "en-GB" : "fr-FR";
}

export default i18n;
