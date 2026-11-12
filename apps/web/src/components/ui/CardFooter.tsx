import type { HTMLAttributes } from "react";
import { cardStyles } from "./card.styles";

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cardStyles().footer({ class: className })} />
  );
}
