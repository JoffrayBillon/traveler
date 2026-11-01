export type TravelerDetailsInput = {
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

const travelerDetailFields = [
  "activityProfile",
  "skiDayThree",
  "transportMode",
  "departureCity",
  "outboundDateTime",
  "outboundTimezone",
  "outboundMeetingTime",
  "outboundDepartureTime",
  "outboundLocation",
  "outboundReference",
  "outboundSeat",
  "returnDateTime",
  "returnTimezone",
  "returnMeetingTime",
  "returnDepartureTime",
  "returnLocation",
  "returnReference",
  "returnSeat",
  "carpoolPreference",
  "parkingPreference",
] as const;

export async function parseTravelerDetails(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false as const };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false as const };
  }
  const record = body as Record<string, unknown>;
  if (travelerDetailFields.some((field) => !(field in record))) {
    return { ok: false as const };
  }
  const nullableStrings = travelerDetailFields.filter(
    (field) => field !== "skiDayThree" && !field.endsWith("Preference"),
  );
  for (const field of nullableStrings) {
    const value = record[field];
    if (value !== null && typeof value !== "string")
      return { ok: false as const };
    if (typeof value === "string" && value.length > 300)
      return { ok: false as const };
  }
  if (typeof record.skiDayThree !== "boolean") return { ok: false as const };
  for (const field of ["carpoolPreference", "parkingPreference"] as const) {
    if (record[field] !== null && typeof record[field] !== "boolean") {
      return { ok: false as const };
    }
  }
  return { ok: true as const, value: record as TravelerDetailsInput };
}

export function validateTravelerDetails(details: TravelerDetailsInput) {
  if (
    details.activityProfile &&
    !["ski", "spa"].includes(details.activityProfile)
  ) {
    return "invalid_activity_profile";
  }
  if (
    details.transportMode &&
    !["train", "flight", "none"].includes(details.transportMode)
  ) {
    return "invalid_transport_mode";
  }
  if (
    ![details.outboundDateTime, details.returnDateTime].every(
      isValidTravelDateTime,
    )
  ) {
    return "invalid_travel_datetime";
  }
  if (
    ![
      details.outboundMeetingTime,
      details.outboundDepartureTime,
      details.returnMeetingTime,
      details.returnDepartureTime,
    ].every(isValidTravelTime)
  ) {
    return "invalid_travel_time";
  }
  if (
    ![details.outboundTimezone, details.returnTimezone].every(isValidTimezone)
  ) {
    return "invalid_travel_timezone";
  }
  if (details.skiDayThree && details.activityProfile !== "ski") {
    return "ski_day_requires_ski_profile";
  }
  if (
    details.transportMode !== "none" &&
    (details.carpoolPreference !== null || details.parkingPreference !== null)
  ) {
    return "carpool_requires_no_transport";
  }
  if (details.parkingPreference && !details.carpoolPreference) {
    return "parking_requires_carpool";
  }
  if (details.transportMode === "none") {
    const fields = [
      details.departureCity,
      details.outboundDateTime,
      details.outboundTimezone,
      details.outboundMeetingTime,
      details.outboundDepartureTime,
      details.outboundLocation,
      details.outboundReference,
      details.outboundSeat,
      details.returnDateTime,
      details.returnTimezone,
      details.returnMeetingTime,
      details.returnDepartureTime,
      details.returnLocation,
      details.returnReference,
      details.returnSeat,
    ];
    if (fields.some(Boolean)) return "no_transport_has_no_journey_details";
  }
  return null;
}

function isValidTravelTime(value: string | null) {
  return value === null || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTravelDateTime(value: string | null) {
  if (value === null) return true;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|([+-]\d{2}:\d{2}))?$/.exec(
      value,
    );
  if (!match) return false;
  const [, year, month, day, hour, minute, second = "0", offset] = match;
  const daysInMonthDate = new Date(0);
  daysInMonthDate.setUTCFullYear(Number(year), Number(month), 0);
  const daysInMonth = daysInMonthDate.getUTCDate();
  const offsetMatch = offset?.match(/^([+-])(\d{2}):(\d{2})$/);
  const validOffset =
    !offsetMatch ||
    (Number(offsetMatch[2]) <= 23 && Number(offsetMatch[3]) <= 59);
  return (
    Number(month) >= 1 &&
    Number(month) <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= daysInMonth &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    validOffset
  );
}

export function synchronizeDepartureTimes(details: TravelerDetailsInput) {
  return {
    ...details,
    outboundDateTime: withDepartureTime(
      details.outboundDateTime,
      details.outboundDepartureTime,
    ),
    returnDateTime: withDepartureTime(
      details.returnDateTime,
      details.returnDepartureTime,
    ),
  };
}

function withDepartureTime(
  dateTime: string | null,
  departureTime: string | null,
) {
  if (!dateTime || !departureTime) return dateTime;
  const match =
    /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      dateTime,
    );
  if (!match) return dateTime;
  return `${match[1]}T${departureTime}:00${match[2] ?? ""}`;
}

function isValidTimezone(value: string | null) {
  if (value === null) return true;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
