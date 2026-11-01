import { tv } from "tailwind-variants";

export const messageStyles = tv({
  base: "rounded-control px-4 py-3 text-sm leading-relaxed",
  variants: {
    tone: {
      neutral: "bg-surface-muted text-content-muted",
      danger:
        "bg-[color-mix(in_srgb,var(--theme-color-danger),transparent_91%)] text-danger",
      success:
        "bg-[color-mix(in_srgb,var(--theme-color-success),transparent_90%)] text-success",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});
