import { tv } from "tailwind-variants";

export const stackStyles = tv({
  base: "grid min-w-0",
  variants: {
    gap: {
      none: "gap-0",
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
    },
  },
  defaultVariants: { gap: "md" },
});

export const inlineStyles = tv({
  base: "flex min-w-0",
  variants: {
    gap: {
      none: "gap-0",
      xs: "gap-1",
      sm: "gap-2",
      md: "gap-3",
      lg: "gap-5",
      xl: "gap-8",
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    },
    justify: {
      start: "justify-start",
      between: "justify-between",
      center: "justify-center",
      end: "justify-end",
    },
    wrap: {
      true: "flex-wrap",
      false: "flex-nowrap",
    },
  },
  defaultVariants: { gap: "md", align: "center", justify: "start", wrap: true },
});

export const pageContainerStyles = tv({
  base: "mx-auto grid w-full min-w-0 px-6 py-12 max-sm:px-4 max-sm:py-6",
  variants: {
    width: {
      narrow: "max-w-3xl",
      standard: "max-w-[1320px]",
      wide: "max-w-[1600px]",
    },
    spacing: {
      compact: "gap-5",
      regular: "gap-8",
      spacious: "gap-10",
    },
  },
  defaultVariants: { width: "standard", spacing: "regular" },
});

export const appFrameStyles = tv({
  slots: {
    root: "flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_50%_-35%,var(--theme-color-page-glow),transparent_57%),var(--theme-color-canvas)] text-content transition-colors duration-200",
    header:
      "mx-auto flex min-h-[92px] w-[min(100%-3rem,1440px)] flex-wrap items-center justify-between gap-4 border-b border-border/75 max-[760px]:min-h-[74px] max-[480px]:w-[min(100%-2rem,1440px)]",
    headerActions: "flex flex-wrap items-center gap-5 max-[760px]:gap-2",
    brand: "inline-flex items-center gap-3 text-content no-underline",
    brandMark:
      "grid size-[2.6rem] place-items-center rounded-card bg-action text-on-action max-[480px]:size-9",
    brandName: "text-2xl font-extrabold tracking-[-0.07em] max-[480px]:text-xl",
    navigation: "flex items-center gap-1",
    navigationLink:
      "rounded-full px-3 py-2 text-sm font-semibold text-content-muted no-underline hover:bg-surface-muted hover:text-content aria-[current=page]:bg-surface-muted aria-[current=page]:text-content max-[760px]:px-2 max-[760px]:text-xs",
    privateAccess:
      "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-content-muted max-[760px]:hidden",
    main: "mx-auto flex w-full max-w-[1600px] flex-1 items-center",
    loading:
      "mx-auto flex w-full flex-1 items-center justify-center gap-4 px-6 text-content-muted",
    loadingMark:
      "grid size-[3.6rem] animate-[mark-breathe_1.8s_ease-in-out_infinite] place-items-center rounded-card bg-surface-muted text-accent",
    footer:
      "mx-auto flex min-h-[74px] w-[min(100%-3rem,1440px)] items-center justify-between gap-4 border-t border-border py-5 text-xs text-content-subtle max-[760px]:w-[min(100%-2rem,1440px)] max-[480px]:flex-col max-[480px]:items-start max-[480px]:justify-center max-[480px]:gap-1",
  },
});
