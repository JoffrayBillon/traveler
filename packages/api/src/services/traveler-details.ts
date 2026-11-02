import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { AppDatabase } from "../auth";
import {
  getTravelerProfileState,
  getTravelerTransportMode,
  saveTravelerProfile as persistTravelerProfile,
  updateTripName as persistTripName,
  saveTravelerCarpoolPreferences,
  saveTravelerDetails,
} from "../datamodel/traveler.repository";

import {
  synchronizeDepartureTimes,
  type TravelerDetailsInput,
  validateTravelerDetails,
} from "./traveler-details-validation";

export type { TravelerDetailsInput } from "./traveler-details-validation";
export {
  isValidTravelDateTime,
  parseTravelerDetails,
  synchronizeDepartureTimes,
} from "./traveler-details-validation";

export async function updateTravelerDetails(
  database: AppDatabase,
  tripId: string,
  userId: string,
  input: TravelerDetailsInput,
) {
  const details = synchronizeDepartureTimes(input);
  const error = validateTravelerDetails(details);
  if (error) return { ok: false as const, error };
  await saveTravelerDetails(database, tripId, userId, details);
  return { ok: true as const };
}

export async function updateCarpoolPreferences(
  database: AppDatabase,
  tripId: string,
  userId: string,
  input: unknown,
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false as const, error: "invalid_preferences" };
  const { carpoolPreference, parkingPreference } = input as Record<
    string,
    unknown
  >;
  if (
    typeof carpoolPreference !== "boolean" ||
    typeof parkingPreference !== "boolean"
  )
    return { ok: false as const, error: "invalid_preferences" };
  if (parkingPreference && !carpoolPreference)
    return { ok: false as const, error: "parking_requires_carpool" };
  const transportMode = await getTravelerTransportMode(
    database,
    tripId,
    userId,
  );
  if (transportMode !== "none")
    return { ok: false as const, error: "carpool_requires_no_transport" };
  await saveTravelerCarpoolPreferences(
    database,
    tripId,
    userId,
    carpoolPreference,
    parkingPreference,
  );
  return { ok: true as const };
}

export async function completeTravelerProfile(
  database: AppDatabase,
  tripId: string,
  userId: string,
  body: unknown,
) {
  const membership = await getTravelerProfileState(database, tripId, userId);
  if (!membership) return { ok: false as const, error: "not_found" };
  const input =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const firstName =
    typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName =
    typeof input.lastName === "string" ? input.lastName.trim() : "";
  const gender = input.gender;
  const dietaryRequirements =
    typeof input.dietaryRequirements === "string"
      ? input.dietaryRequirements.trim()
      : "";
  const allergens =
    typeof input.allergens === "string" ? input.allergens.trim() : "";
  const emergencyContactFirstName =
    typeof input.emergencyContactFirstName === "string"
      ? input.emergencyContactFirstName.trim()
      : "";
  const emergencyContactLastName =
    typeof input.emergencyContactLastName === "string"
      ? input.emergencyContactLastName.trim()
      : "";
  const emergencyContactPhone =
    typeof input.emergencyContactPhone === "string"
      ? input.emergencyContactPhone.trim()
      : "";
  const parsedPhone = parsePhoneNumberFromString(emergencyContactPhone);
  if (
    firstName.length < 1 ||
    firstName.length > 100 ||
    lastName.length < 1 ||
    lastName.length > 100 ||
    (gender !== "M" && gender !== "F") ||
    dietaryRequirements.length > 500 ||
    allergens.length > 500 ||
    emergencyContactFirstName.length < 1 ||
    emergencyContactFirstName.length > 100 ||
    emergencyContactLastName.length < 1 ||
    emergencyContactLastName.length > 100 ||
    emergencyContactPhone.length > 40 ||
    !parsedPhone?.isValid()
  )
    return { ok: false as const, error: "invalid_profile" };
  if (membership.genderConfirmed && membership.gender !== gender)
    return {
      ok: false as const,
      error: "gender_locked",
    };
  const saved = await persistTravelerProfile(database, tripId, userId, {
    firstName,
    lastName,
    gender,
    dietaryRequirements,
    allergens,
    emergencyContactFirstName,
    emergencyContactLastName,
    emergencyContactPhone: parsedPhone.number,
  });
  if (!saved) return { ok: false as const, error: "gender_locked" };
  return { ok: true as const };
}

export async function renameTrip(
  database: AppDatabase,
  tripId: string,
  value: unknown,
) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120)
    return { ok: false as const, error: "invalid_trip_name" };
  const name = value.trim();
  await persistTripName(database, tripId, name);
  return { ok: true as const, name };
}
