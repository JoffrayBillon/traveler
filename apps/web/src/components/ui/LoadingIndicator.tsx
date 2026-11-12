import { LoaderCircle } from "lucide-react";

export function LoadingIndicator({ label }: { label: string }) {
  return (
    <div
      className="grid min-h-[35vh] w-full place-items-center text-accent"
      role="status"
    >
      <LoaderCircle
        aria-hidden="true"
        className="motion-safe:animate-spin"
        size={24}
        strokeWidth={1.8}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
