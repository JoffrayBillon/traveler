import { textFieldStyles } from "@traveler/components/ui";
import { Search } from "lucide-react";
import { Input, Label, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";

export function ParticipantSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <TextField
      className="grid max-w-xl gap-2"
      value={value}
      onChange={onChange}
    >
      <Label className={textFieldStyles().label()}>
        {t("searchParticipants")}
      </Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle"
          size={17}
        />
        <Input
          className={`${textFieldStyles().input()} pl-10`}
          type="search"
          autoComplete="off"
        />
      </div>
    </TextField>
  );
}
