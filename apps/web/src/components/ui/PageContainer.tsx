import type { ElementType, HTMLAttributes } from "react";
import type { VariantProps } from "tailwind-variants";
import { pageContainerStyles } from "./layout.styles";

type PageContainerProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof pageContainerStyles> & { as?: ElementType };

export function PageContainer({
  className,
  as,
  width,
  spacing,
  ...props
}: PageContainerProps) {
  const Component = as ?? "div";
  return (
    <Component
      {...props}
      className={pageContainerStyles({ width, spacing, class: className })}
    />
  );
}
