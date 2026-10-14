export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function getIndiaDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(Date.UTC(year, month - 1, day + offsetDays))
    .toISOString()
    .slice(0, 10);
}

export function indiaDateTime(date: string, hour: number, minute = 0): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`;
}

export function getIndiaDateTimeBounds(date: string, startHour: number, endHour: number) {
  return {
    start: new Date(indiaDateTime(date, startHour)),
    end:
      endHour === 24
        ? new Date(indiaDateTime(addCalendarDays(date, 1), 0))
        : new Date(indiaDateTime(date, endHour)),
  };
}
