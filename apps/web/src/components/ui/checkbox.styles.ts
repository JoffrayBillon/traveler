import { tv } from "tailwind-variants";

export const checkboxStyles = tv({
  base: "inline-flex cursor-pointer items-center gap-3 before:size-[1.1rem] before:shrink-0 before:rounded before:border before:border-[var(--quiet)] before:bg-[var(--surface)] before:content-[''] data-[selected]:before:border-[var(--forest-bright)] data-[selected]:before:bg-[var(--forest-bright)] data-[selected]:before:shadow-[inset_0_0_0_3px_var(--surface)]",
});
