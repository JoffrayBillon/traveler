import { tv } from "tailwind-variants";

export const textFieldStyles = tv({
  slots: {
    label: "block text-sm font-bold text-content",
    input:
      "min-h-11 w-full rounded-control border border-border bg-surface px-3 py-2 text-content outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60",
  },
});
