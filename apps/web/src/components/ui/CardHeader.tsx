import type { HTMLAttributes } from "react";
import { cardStyles } from "./card.styles";

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cardStyles().header({ class: className })} />
  );
}
