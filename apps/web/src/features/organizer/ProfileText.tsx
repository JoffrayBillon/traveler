import { textFieldStyles } from "@traveler/components/ui";
import { Input, Label, TextField } from "react-aria-components";

export function ProfileText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField className="grid min-w-0 gap-2" value={value} onChange={onChange}>
      <Label className={textFieldStyles().label()}>{label}</Label>
      <Input className={textFieldStyles().input()} />
    </TextField>
  );
}
