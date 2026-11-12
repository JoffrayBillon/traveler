import { tv } from "tailwind-variants";

export const listBoxStyles = tv({
  slots: {
    list: "grid max-h-64 min-w-0 gap-1 overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-panel",
    item: "flex min-h-10 min-w-0 cursor-pointer items-center rounded-control border border-transparent px-3 py-2 text-content outline-none transition-colors data-[hovered]:bg-surface-muted data-[focused]:outline-2 data-[focused]:outline-offset-[-2px] data-[focused]:outline-focus data-[selected]:border-accent/50 data-[selected]:bg-surface-muted data-[selected]:font-semibold",
  },
});
