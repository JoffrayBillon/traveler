import { ChevronDown } from "lucide-react";
import { forwardRef, type ReactNode } from "react";
import { Button } from "./Button";

type SelectTriggerProps = {
  children: ReactNode;
  className?: string | undefined;
};

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger({ children, className }, ref) {
    return (
      <Button
        appearance="select"
        {...(className ? { className } : {})}
        data-select-trigger
        ref={ref}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronDown
          aria-hidden="true"
          className="select-trigger-chevron shrink-0"
          size={16}
        />
      </Button>
    );
  },
);
