export type TransportSegment = {
  id?: string;
  direction: "outbound" | "return";
  position?: number;
  mode: "train" | "flight";
  origin: string;
  destination: string;
  departureAt: string | null;
  arrivalAt: string | null;
  serviceReference: string | null;
};

export type TransportGroup = {
  id: string;
  tripId: string;
  name: string;
  sourceCity: string;
  normalizedCity: string;
  isDraft: boolean;
  outboundMeetingAt: string | null;
  outboundMeetingPlace: string | null;
  returnMeetingAt: string | null;
  returnMeetingPlace: string | null;
  segments: TransportSegment[];
  travelers: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
  }[];
};

export type TransportView = {
  groups: TransportGroup[];
  participants: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    transportChoice: "group" | "none" | "unconfirmed";
    groupId: string | null;
    carpoolRole: "none" | "driver" | "passenger" | "undecided";
    carpoolDriverUserId: string | null;
    passengerCount: number;
  }[];
  drivers: {
    userId: string;
    firstName: string;
    lastName: string;
    passengerCount: number;
  }[];
  self: {
    transportChoice: "group" | "none" | "unconfirmed";
    groupId: string | null;
    carpoolRole: "none" | "driver" | "passenger" | "undecided";
    carpoolDriverUserId: string | null;
  } | null;
};

export type TransportGroupInput = Omit<
  TransportGroup,
  "id" | "tripId" | "normalizedCity" | "isDraft" | "travelers"
>;
