import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function parsePersonalPhone(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 40) return null;
  const phone = value.trim();
  if (!phone) return "";
  const parsed = parsePhoneNumberFromString(phone, {
    defaultCountry: "FR",
    extract: false,
  });
  return parsed?.isValid() && !parsed.ext ? parsed.number : null;
}
