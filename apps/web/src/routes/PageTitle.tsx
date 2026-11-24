import { useLayoutEffect } from "react";

export function PageTitle({ title }: { title: string }) {
  useLayoutEffect(() => {
    document.title = `${title} · Traveler`;
  }, [title]);
  return null;
}
