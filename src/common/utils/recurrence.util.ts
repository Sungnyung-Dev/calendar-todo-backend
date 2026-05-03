import {
  addUtcDays,
  daysBetweenUtc,
  monthsBetweenUtc,
  parseDateOnly,
  startOfUtcWeek,
  toDateOnly,
} from './date.util';
import {
  DayOfWeek,
  RecurrenceFrequency,
  RecurrenceRuleDto,
} from '../dto/recurrence-rule.dto';

const dayNames: DayOfWeek[] = [
  DayOfWeek.SUN,
  DayOfWeek.MON,
  DayOfWeek.TUE,
  DayOfWeek.WED,
  DayOfWeek.THU,
  DayOfWeek.FRI,
  DayOfWeek.SAT,
];

export type RecurrenceRule = RecurrenceRuleDto;

const normalizeRule = (value: unknown): RecurrenceRule | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as RecurrenceRule;
};

const isOccurrenceMatch = (
  baseDate: Date,
  candidate: Date,
  rule: RecurrenceRule,
): boolean => {
  const interval = rule.interval ?? 1;

  if (rule.frequency === RecurrenceFrequency.daily) {
    return daysBetweenUtc(baseDate, candidate) % interval === 0;
  }

  if (rule.frequency === RecurrenceFrequency.weekly) {
    const baseWeek = startOfUtcWeek(baseDate);
    const candidateWeek = startOfUtcWeek(candidate);
    const weekDiff = daysBetweenUtc(baseWeek, candidateWeek) / 7;
    const allowedDays = rule.daysOfWeek?.length
      ? rule.daysOfWeek
      : [dayNames[baseDate.getUTCDay()]];

    return (
      weekDiff % interval === 0 &&
      allowedDays.includes(dayNames[candidate.getUTCDay()])
    );
  }

  if (rule.frequency === RecurrenceFrequency.monthly) {
    return (
      monthsBetweenUtc(baseDate, candidate) % interval === 0 &&
      candidate.getUTCDate() === baseDate.getUTCDate()
    );
  }

  return false;
};

export const expandRecurrenceDates = (
  baseDate: Date,
  recurrenceRule: unknown,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] => {
  const rule = normalizeRule(recurrenceRule);
  if (!rule) {
    return [];
  }

  const ruleEnd = rule.endDate ? parseDateOnly(rule.endDate) : null;
  const dates: Date[] = [];
  let current = rangeStart > baseDate ? rangeStart : baseDate;

  while (current <= rangeEnd) {
    if (ruleEnd && current > ruleEnd) {
      break;
    }
    if (isOccurrenceMatch(baseDate, current, rule)) {
      dates.push(current);
    }
    current = addUtcDays(current, 1);
  }

  return dates;
};

export const buildOccurrenceMap = <T extends { occurrenceDate: Date }>(
  occurrences: T[],
): Map<string, T> =>
  new Map(
    occurrences.map((occurrence) => [
      toDateOnly(occurrence.occurrenceDate),
      occurrence,
    ]),
  );
