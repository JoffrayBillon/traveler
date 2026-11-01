export type TravelerTripData = {
  trip: { id: string; name: string };
  traveler: {
    firstName: string;
    lastName: string;
    gender: "M" | "F" | null;
    genderConfirmed: boolean;
    role: "traveler" | "companion" | "manager";
  };
  profile?: {
    dietaryRequirements: string | null;
    allergens: string | null;
    emergencyContactFirstName: string | null;
    emergencyContactLastName: string | null;
    emergencyContactPhone: string | null;
    completed: boolean;
  };
  details: null | {
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
    updatedAt: string | null;
  };
  tickets: {
    id: string;
    kind: "outbound" | "return" | "other";
    originalName: string;
    size: number;
    createdAt: string;
  }[];
};
