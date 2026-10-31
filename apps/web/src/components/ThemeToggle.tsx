import { Moon, Sun } from "lucide-react";
import { ToggleButton } from "react-aria-components";

export function ThemeToggle({
  isDark,
  onChange,
}: {
  isDark: boolean;
  onChange: (isDark: boolean) => void;
}) {
  return (
    <ToggleButton
      aria-label={isDark ? "Activer le thème clair" : "Activer le thème sombre"}
      className="theme-toggle"
      isSelected={isDark}
      onChange={onChange}
    >
      {isDark ? (
        <Sun aria-hidden="true" size={17} />
      ) : (
        <Moon aria-hidden="true" size={17} />
      )}
      <span>{isDark ? "Clair" : "Sombre"}</span>
    </ToggleButton>
  );
}
