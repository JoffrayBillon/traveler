import {
  AsYouType,
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/max";

export function getInitialPhone(phone: string) {
  const parsed = parsePhoneNumberFromString(phone);
  const country: CountryCode = parsed?.country ?? "FR";
  return {
    country,
    value: parsed
      ? formatPhoneInput(parsed.formatNational(), country)
      : formatPhoneInput(phone, country),
  };
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
