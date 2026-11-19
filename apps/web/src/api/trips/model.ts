import type { TravelerProfileValues } from "@traveler/api/profile/profile.types";
import type { TravelerTripData } from "./trip.types";

export const emptyTravelerProfile = {
  dietaryRequirements: null,
  allergens: null,
  emergencyContactFirstName: null,
  emergencyContactLastName: null,
  emergencyContactPhone: null,
  personalPhone: null,
  completed: false,
};

export function applyProfileValues(
  current: TravelerTripData,
  values: TravelerProfileValues,
): TravelerTripData {
  return {
    ...current,
    traveler: {
      ...current.traveler,
      firstName: values.firstName,
      lastName: values.lastName,
      gender: values.gender,
      genderConfirmed: values.genderConfirmed,
    },
    profile: {
      dietaryRequirements: values.dietaryRequirements,
      allergens: values.allergens,
      emergencyContactFirstName: values.emergencyContactFirstName,
      emergencyContactLastName: values.emergencyContactLastName,
      emergencyContactPhone: values.emergencyContactPhone,
      personalPhone: values.personalPhone ?? null,
      completed: values.completed,
    },
  };
}
