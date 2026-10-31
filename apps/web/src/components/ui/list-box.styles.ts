import { tv } from "tailwind-variants";

export const listBoxStyles = tv({
  slots: {
    list: "max-h-64 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow)]",
    item: "cursor-pointer rounded-lg px-3 py-2 text-[var(--ink)] outline-none data-[focused]:bg-[var(--surface-soft)] data-[selected]:bg-[var(--surface-soft)]",
  },
});
