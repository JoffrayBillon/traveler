import type { HTMLAttributes } from "react";
import { cardStyles } from "./card.styles";

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...props} className={cardStyles().description({ class: className })} />
  );
}
