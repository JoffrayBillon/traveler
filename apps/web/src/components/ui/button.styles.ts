import { tv } from "tailwind-variants";

export const buttonStyles = tv({
  base: "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-2 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60",
  variants: {
    appearance: {
      primary: "bg-action font-bold text-on-action hover:bg-action-hover",
      secondary:
        "border border-border bg-surface-muted text-content hover:bg-surface",
      select:
        "w-full justify-between border border-border bg-surface text-left text-content",
      quiet: "bg-transparent text-danger hover:bg-surface-muted",
      quietNeutral: "bg-transparent text-content hover:bg-surface-muted",
      toggle:
        "min-h-11 rounded-full border border-border bg-surface text-sm text-content hover:border-content-subtle hover:bg-surface-muted data-[selected]:bg-surface-muted",
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
