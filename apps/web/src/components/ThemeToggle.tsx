import { Moon, Sun } from "lucide-react";
import { ToggleButton } from "react-aria-components";
import { buttonStyles } from "./ui";

export function ThemeToggle({
  isDark,
  onChange,
}: {
  isDark: boolean;
  onChange: (isDark: boolean) => void;
}) {
  return (
    <ToggleButton
      aria-label="Mode sombre"
      className={buttonStyles({ appearance: "toggle" })}
      isSelected={isDark}
      onChange={onChange}
    >
      {isDark ? (
        <Sun aria-hidden="true" size={17} />
      ) : (
        <Moon aria-hidden="true" size={17} />
      )}
      <span>Mode sombre</span>
    </ToggleButton>
  );
}
