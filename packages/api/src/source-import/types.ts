export type ImportError = {
  row: number;
  field: string;
  message: string;
};

export type ValidatedRosterRow = {
  row: number;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: "M" | "F" | null;
  activityProfile: "ski" | "spa";
  amountPaidMinor: number | null;
  amountDueMinor: number | null;
  paymentStatus: "paid" | "partially_paid" | "unpaid" | null;
};

export type DetailedOrderRow = {
  row: number;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: "M" | "F" | null;
  bookingStatus: "pending" | "validated";
  paymentStatus: "paid" | "partially_paid" | "unpaid" | null;
  activityProfile: "ski" | "spa";
  skiDayThree: boolean;
  transportMode: "train" | "none";
  departureCity: string | null;
};

export type StaffImportRow = {
  row: number;
  firstName: string;
  lastName: string;
  email: string;
  gender: "M" | "F";
  role: "companion" | "traveler";
  isVip: boolean;
  activityProfile: "ski" | "spa";
  skiDayThree: boolean;
  transportMode: "train" | "none";
  departureCity: string | null;
};

export type AgencyRoomingRow = {
  row: number;
  firstName: string;
  lastName: string;
  outboundSeat: string | null;
  returnSeat: string | null;
};

export type ParseResult<T> = { rows: T[]; errors: ImportError[] };
