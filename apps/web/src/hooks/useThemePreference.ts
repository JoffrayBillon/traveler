import { useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "traveler-theme";

function readInitialPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

export function useThemePreference() {
  const [preference, setPreference] = useState(readInitialPreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = () => setSystemPrefersDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const isDark =
    preference === "system" ? systemPrefersDark : preference === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // The selected theme still applies when browser storage is unavailable.
    }
  }, [isDark, preference]);

  return { preference, setPreference, isDark };
}
