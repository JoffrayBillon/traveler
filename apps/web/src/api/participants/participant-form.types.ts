import type { StaffTraveler } from "./participant.types";

export type SaveParticipantInput = {
  participant: StaffTraveler;
  profile: ProfileDraft;
  details: DetailsDraft;
  email: string;
  role: StaffTraveler["role"];
  isManager: boolean;
};

export type ProfileDraft = Pick<
  StaffTraveler,
  | "firstName"
  | "lastName"
  | "gender"
  | "dietaryRequirements"
  | "allergens"
  | "emergencyContactFirstName"
  | "emergencyContactLastName"
  | "emergencyContactPhone"
>;

export type DetailsDraft = Pick<
  StaffTraveler,
  "activityProfile" | "skiDayThree"
>;
