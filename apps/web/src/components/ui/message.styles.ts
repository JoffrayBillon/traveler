import { tv } from "tailwind-variants";

export const messageStyles = tv({
  base: "mt-3 rounded-xl px-4 py-3 text-sm leading-relaxed",
  variants: {
    tone: {
      neutral: "bg-[var(--surface-soft)] text-[var(--muted)]",
      danger:
        "bg-[color-mix(in_srgb,var(--danger),transparent_91%)] text-[var(--danger)]",
      success:
        "bg-[color-mix(in_srgb,var(--success),transparent_90%)] text-[var(--success)]",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});
