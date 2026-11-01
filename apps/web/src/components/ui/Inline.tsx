import type { HTMLAttributes } from "react";
import type { VariantProps } from "tailwind-variants";
import { inlineStyles } from "./layout.styles";

type InlineProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof inlineStyles>;

export function Inline({
  className,
  gap,
  align,
  justify,
  wrap,
  ...props
}: InlineProps) {
  return (
    <div
      {...props}
      className={inlineStyles({ gap, align, justify, wrap, class: className })}
    />
  );
}
