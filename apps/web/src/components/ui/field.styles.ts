import { tv } from "tailwind-variants";

export const textFieldStyles = tv({
  slots: {
    label: "mb-2 block text-sm font-bold text-[var(--ink)]",
    input:
      "min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-60",
  },
});
