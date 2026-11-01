import type { StaffTraveler } from "./types";

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
  | "activityProfile"
  | "skiDayThree"
  | "transportMode"
  | "departureCity"
  | "outboundDateTime"
  | "outboundMeetingTime"
  | "outboundDepartureTime"
  | "outboundLocation"
  | "outboundReference"
  | "outboundSeat"
  | "returnDateTime"
  | "returnMeetingTime"
  | "returnDepartureTime"
  | "returnLocation"
  | "returnReference"
  | "returnSeat"
  | "carpoolPreference"
  | "parkingPreference"
>;
