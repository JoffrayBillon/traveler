import { tv } from "tailwind-variants";

export const checkboxStyles = tv({
  base: "inline-flex cursor-pointer items-center gap-3 before:size-[1.1rem] before:shrink-0 before:rounded before:border before:border-content-subtle before:bg-surface before:content-[''] data-[focus-visible]:outline-3 data-[focus-visible]:outline-offset-3 data-[focus-visible]:outline-focus data-[selected]:before:border-accent data-[selected]:before:bg-accent data-[selected]:before:shadow-[inset_0_0_0_3px_var(--theme-color-surface)] forced-colors:data-[selected]:before:content-['✓'] forced-colors:data-[selected]:before:border-[CanvasText] forced-colors:data-[selected]:before:text-[CanvasText] forced-colors:data-[selected]:before:shadow-none",
});
