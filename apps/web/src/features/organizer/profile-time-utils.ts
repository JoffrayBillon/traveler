import {
  type CalendarDateTime,
  parseDateTime,
  parseTime,
  type Time,
} from "@internationalized/date";

export function parseDateTimeSafely(value: string): CalendarDateTime | null {
  if (!value) return null;
  try {
    return parseDateTime(value);
  } catch {
    return null;
  }
}

export function parseTimeSafely(value: string): Time | null {
  if (!value) return null;
  try {
    return parseTime(value);
  } catch {
    return null;
  }
}

export function padTime(value: number) {
  return String(value).padStart(2, "0");
}

export function getTimeOptions(selectedTime: string) {
  const options = Array.from({ length: 96 }, (_, index) => {
    const minutes = index * 15;
    return `${padTime(Math.floor(minutes / 60))}:${padTime(minutes % 60)}`;
  });
  if (selectedTime && !options.includes(selectedTime)) {
    options.push(selectedTime);
    options.sort();
  }
  return options;
}
