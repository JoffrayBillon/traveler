import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import type { VariantProps } from "tailwind-variants";
import { buttonStyles } from "./button.styles";

type ButtonProps = Omit<AriaButtonProps, "className"> &
  VariantProps<typeof buttonStyles> & {
    className?: string;
  };

export function Button({
  appearance,
  size,
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={buttonStyles({
        appearance,
        size,
        fullWidth,
        class: className,
      })}
    />
  );
}
