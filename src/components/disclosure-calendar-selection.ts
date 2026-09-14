export function resolveSelectedCalendarDay(rawDay: string | undefined, lastDay: number, availableDays: Iterable<number>): number {
  const requestedDay = Number(rawDay);
  if (Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= lastDay) return requestedDay;
  return availableDays[Symbol.iterator]().next().value ?? 1;
}
