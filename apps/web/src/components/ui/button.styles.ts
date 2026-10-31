import { tv } from "tailwind-variants";

export const buttonStyles = tv({
  base: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
  variants: {
    appearance: {
      primary:
        "bg-[var(--forest-deep)] font-bold text-white hover:bg-[var(--forest-bright)]",
      secondary:
        "border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] hover:bg-[var(--surface)]",
      select:
        "w-full justify-between border border-[var(--line)] bg-[var(--surface)] text-left text-[var(--ink)]",
      quiet:
        "bg-transparent text-[var(--danger)] hover:bg-[var(--surface-soft)]",
      toggle:
        "min-h-11 rounded-full border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--ink)] hover:border-[var(--quiet)] hover:bg-[var(--surface-soft)] data-[selected]:bg-[var(--surface-soft)]",
    },
    size: {
      sm: "min-h-9 px-3 py-1.5 text-sm",
      md: "min-h-11 px-4 py-2 text-sm",
    },
    fullWidth: {
      true: "w-full",
      false: "",
    },
  },
  defaultVariants: {
    appearance: "secondary",
    size: "md",
    fullWidth: false,
  },
});
