import { tv } from "tailwind-variants";

export const modalFormStyles = tv({
  slots: {
    overlay:
      "fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_140ms_ease-out] data-[exiting]:animate-[fade-out_120ms_ease-in] max-sm:items-end max-sm:p-0",
    modal:
      "my-auto w-full max-w-5xl outline-none data-[entering]:animate-[modal-enter_220ms_ease-out] data-[exiting]:animate-[modal-exit_150ms_ease-in]",
    dialog:
      "mx-auto flex h-[min(92dvh,66rem)] max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-feature border border-border bg-surface p-0 text-content shadow-panel outline-none max-sm:h-[94dvh] max-sm:max-h-[94dvh] max-sm:rounded-b-none max-sm:rounded-t-feature",
    header:
      "flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-8 lg:px-10",
    headerContent: "grid gap-2",
    title: "text-xl font-bold tracking-tight sm:text-2xl",
    description: "block max-w-prose text-sm leading-relaxed text-content-muted",
    form: "flex min-h-0 flex-1 flex-col",
    content:
      "grid min-h-0 flex-1 content-start gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6 lg:px-10",
    footer:
      "grid shrink-0 gap-3 border-t border-border bg-surface px-5 py-4 sm:px-8 lg:px-10",
    message:
      "rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger",
    actions: "flex flex-wrap justify-end gap-2",
  },
});
