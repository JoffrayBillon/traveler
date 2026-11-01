import * as CountryFlags from "country-flag-icons/react/3x2";
import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";
import { useMemo } from "react";
import {
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
  TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import {
  listBoxStyles,
  SelectTrigger,
  textFieldStyles,
} from "../../components/ui";

const countryCodes = getCountries();
const countryFlagComponents = CountryFlags as unknown as Record<
  string,
  typeof CountryFlags.FR
>;

function CountryFlag({ country }: { country: CountryCode }) {
  const Flag = countryFlagComponents[country];
  return Flag ? (
    <Flag aria-hidden="true" className="h-4 w-6 shrink-0 rounded-[2px]" />
  ) : null;
}

export function formatPhoneInput(value: string, country: CountryCode) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (country === "FR") {
    const nationalDigits = digits.startsWith("0") ? digits.slice(1) : digits;
    return new AsYouType("FR").input(`0${nationalDigits}`).replace(/^0\s?/, "");
  }

  return new AsYouType(country).input(digits);
}

export function PhoneNumberField({
  value,
  country,
  onChange,
  onCountryChange,
  onBlur,
  isInvalid,
  errorMessage,
}: {
  value: string;
  country: CountryCode;
  onChange: (value: string) => void;
  onCountryChange: (country: CountryCode) => void;
  onBlur: () => void;
  isInvalid: boolean;
  errorMessage: string;
}) {
  const { t, i18n } = useTranslation();
  const countryNames = useMemo(
    () =>
      new Intl.DisplayNames([i18n.resolvedLanguage ?? "fr"], {
        type: "region",
      }),
    [i18n.resolvedLanguage],
  );
  const countries = useMemo(
    () =>
      countryCodes
        .map((code) => ({
          code,
          name: countryNames.of(code) ?? code,
          callingCode: getCountryCallingCode(code),
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [countryNames],
  );
  const selectedCountry = countries.find((item) => item.code === country);

  return (
    <TextField
      className="grid min-w-0 gap-2"
      type="tel"
      value={value}
      onChange={(input) => {
        const internationalPhone = input.trim().startsWith("+")
          ? parsePhoneNumberFromString(input)
          : undefined;
        if (internationalPhone?.country) {
          onCountryChange(internationalPhone.country);
          onChange(
            formatPhoneInput(
              internationalPhone.formatNational(),
              internationalPhone.country,
            ),
          );
          return;
        }
        onChange(formatPhoneInput(input, country));
      }}
      onBlur={onBlur}
      isRequired
      isInvalid={isInvalid}
    >
      <Label className={textFieldStyles().label()}>{t("phoneNumber")}</Label>
      <div className="flex h-11 min-w-0 items-stretch overflow-hidden rounded-control border border-border bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus">
        <Select
          aria-label={t("chooseCountry")}
          className="shrink-0"
          selectedKey={country}
          onSelectionChange={(key) => {
            if (typeof key !== "string") return;
            const nextCountry = key as CountryCode;
            onCountryChange(nextCountry);
            onChange(formatPhoneInput(value, nextCountry));
          }}
        >
          <SelectTrigger className="h-full min-h-0 w-auto min-w-max shrink-0 justify-start gap-1 whitespace-nowrap rounded-r-none border-0 border-r border-border bg-transparent px-3 text-sm hover:bg-surface-muted focus-visible:outline-0 focus-visible:ring-0">
            <SelectValue>
              {() => (
                <span className="flex min-w-0 items-center gap-2">
                  <CountryFlag country={country} />
                  <span className="whitespace-nowrap">
                    +{selectedCountry?.callingCode}
                    {country === "FR" ? " (0)" : ""}
                  </span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <Popover className="z-[60] max-h-80 w-[min(22rem,calc(100vw-2rem))] outline-none">
            <ListBox
              className={`${listBoxStyles().list()} max-h-72 overflow-y-auto`}
            >
              {countries.map(({ code, name, callingCode }) => (
                <ListBoxItem
                  className={listBoxStyles().item()}
                  id={code}
                  key={code}
                  textValue={`${name} +${callingCode}`}
                >
                  <span className="flex w-full min-w-0 items-center gap-3">
                    <CountryFlag country={code} />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <span className="shrink-0 text-content-muted">
                      +{callingCode}
                      {code === "FR" ? " (0)" : ""}
                    </span>
                  </span>
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
        <Input
          className="h-full min-h-0 min-w-0 flex-1 rounded-r-control bg-transparent px-3 py-2 text-content outline-none placeholder:text-content-subtle"
          autoComplete="tel-national"
          inputMode="tel"
          maxLength={30}
        />
      </div>
      {isInvalid && (
        <Text slot="errorMessage" className="text-sm text-danger">
          {errorMessage}
        </Text>
      )}
    </TextField>
  );
}
