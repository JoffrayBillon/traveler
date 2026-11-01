import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type { VariantProps } from "tailwind-variants";
import { cardStyles } from "./card.styles";

type CardVariants = VariantProps<typeof cardStyles>;

type CardProps<T extends ElementType> = Omit<
  ComponentPropsWithoutRef<T>,
  "as" | "className"
> &
  CardVariants & {
    as?: T;
    className?: string;
    children: ReactNode;
  };

export function Card<T extends ElementType = "div">({
  as,
  elevation,
  tone,
  spacing,
  arrangement,
  className,
  children,
  ...props
}: CardProps<T>) {
  const Component = as ?? "div";
  const styles = cardStyles({ elevation, tone, spacing, arrangement });
  return (
    <Component {...props} className={styles.root({ class: className })}>
      {children}
    </Component>
  );
}
