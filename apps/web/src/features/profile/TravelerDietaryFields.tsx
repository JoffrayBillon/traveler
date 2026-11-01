import { textFieldStyles } from "@traveler/components/ui";
import { Label, TextArea, TextField } from "react-aria-components";
import { useTranslation } from "react-i18next";

export function TravelerDietaryFields({
  dietaryRequirements,
  allergens,
  onDietaryRequirementsChange,
  onAllergensChange,
}: {
  dietaryRequirements: string;
  allergens: string;
  onDietaryRequirementsChange: (value: string) => void;
  onAllergensChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="grid gap-4 border-0 border-t border-border p-0 pt-5">
      <legend className="pr-1 text-base font-bold">{t("dietaryNeeds")}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          className="grid min-w-0 gap-2"
          value={dietaryRequirements}
          onChange={onDietaryRequirementsChange}
        >
          <Label className={textFieldStyles().label()}>
            {t("dietaryRequirements")}
          </Label>
          <TextArea
            className={textFieldStyles().input()}
            rows={3}
            maxLength={500}
            placeholder={t("leaveBlankIfNoDietaryRequirements")}
          />
        </TextField>
        <TextField
          className="grid min-w-0 gap-2"
          value={allergens}
          onChange={onAllergensChange}
        >
          <Label className={textFieldStyles().label()}>{t("allergens")}</Label>
          <TextArea
            className={textFieldStyles().input()}
            rows={3}
            maxLength={500}
            placeholder={t("leaveBlankIfNoAllergens")}
          />
        </TextField>
      </div>
    </fieldset>
  );
}
