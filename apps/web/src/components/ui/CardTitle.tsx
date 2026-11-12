import type { HTMLAttributes } from "react";
import { cardStyles } from "./card.styles";

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={cardStyles().title({ class: className })} />;
}
