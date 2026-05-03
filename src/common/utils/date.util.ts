export const parseDateOnly = (value: string): Date =>
  new Date(`${value}T00:00:00.000Z`);

export const toDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const daysBetweenUtc = (from: Date, to: Date): number => {
  const fromUtc = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const toUtc = Date.UTC(
    to.getUTCFullYear(),
    to.getUTCMonth(),
    to.getUTCDate(),
  );
  return Math.floor((toUtc - fromUtc) / 86_400_000);
};

export const monthsBetweenUtc = (from: Date, to: Date): number =>
  (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
  (to.getUTCMonth() - from.getUTCMonth());

export const startOfUtcWeek = (date: Date): Date => {
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addUtcDays(date, mondayOffset);
};

export const shiftDateTimeToOccurrenceDate = (
  value: Date,
  occurrenceDate: Date,
): Date =>
  new Date(
    Date.UTC(
      occurrenceDate.getUTCFullYear(),
      occurrenceDate.getUTCMonth(),
      occurrenceDate.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
