import * as CountryFlags from "country-flag-icons/react/3x2";
import type { CountryCode } from "libphonenumber-js/max";

const countryFlagComponents = CountryFlags as unknown as Record<
  string,
  typeof CountryFlags.FR
>;

export function CountryFlag({ country }: { country: CountryCode }) {
  const Flag = countryFlagComponents[country];
  return Flag ? (
    <Flag aria-hidden="true" className="h-4 w-6 shrink-0 rounded-[2px]" />
  ) : null;
}
