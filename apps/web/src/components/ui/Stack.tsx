import type { HTMLAttributes } from "react";
import type { VariantProps } from "tailwind-variants";
import { stackStyles } from "./layout.styles";

type StackProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof stackStyles>;

export function Stack({ className, gap, ...props }: StackProps) {
  return <div {...props} className={stackStyles({ gap, class: className })} />;
}
