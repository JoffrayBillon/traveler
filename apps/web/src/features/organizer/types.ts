import type { TripRole } from "../../types/profile";

export type StaffTraveler = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: TripRole;
  activityProfile: "ski" | "spa" | null;
  skiDayThree: boolean;
  transportMode: "train" | "flight" | "none" | null;
  departureCity: string | null;
  outboundDateTime: string | null;
  outboundTimezone: string | null;
  outboundMeetingTime: string | null;
  outboundDepartureTime: string | null;
  outboundLocation: string | null;
  outboundReference: string | null;
  outboundSeat: string | null;
  returnDateTime: string | null;
  returnTimezone: string | null;
  returnMeetingTime: string | null;
  returnDepartureTime: string | null;
  returnLocation: string | null;
  returnReference: string | null;
  returnSeat: string | null;
  carpoolPreference: boolean | null;
  parkingPreference: boolean | null;
};
