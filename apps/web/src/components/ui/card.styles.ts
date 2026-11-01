import { tv } from "tailwind-variants";

export const cardStyles = tv({
  slots: {
    root: "min-w-0 overflow-hidden rounded-card border text-content transition-colors",
    header: "grid gap-1.5 p-5",
    title: "text-lg font-semibold leading-tight tracking-[-0.02em]",
    description: "text-sm leading-relaxed text-content-muted",
    content: "min-w-0 p-5 pt-0",
    footer: "flex flex-wrap items-center gap-3 border-t border-border p-5",
  },
  variants: {
    elevation: {
      flat: { root: "shadow-none" },
      raised: { root: "shadow-card" },
      floating: { root: "shadow-panel" },
    },
    tone: {
      surface: { root: "border-border bg-surface" },
      muted: { root: "border-border/70 bg-surface-muted/70" },
      accent: { root: "border-accent/30 bg-accent/10" },
    },
    spacing: {
      none: { root: "p-0" },
      dense: { root: "p-3" },
      compact: { root: "p-4" },
      comfortable: { root: "p-5" },
    },
    arrangement: {
      none: { root: "" },
      stack: { root: "grid gap-4" },
      form: {
        root: "grid grid-cols-2 items-end gap-3 max-[420px]:grid-cols-1",
      },
      row: { root: "flex flex-wrap items-center gap-3" },
    },
  },
  defaultVariants: {
    elevation: "raised",
    tone: "surface",
    spacing: "none",
    arrangement: "none",
  },
});
