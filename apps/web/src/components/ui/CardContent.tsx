import type { HTMLAttributes } from "react";
import { cardStyles } from "./card.styles";

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cardStyles().content({ class: className })} />
  );
}
