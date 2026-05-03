import { BadRequestException, Injectable } from '@nestjs/common';
import {
  addUtcDays,
  parseDateOnly,
  shiftDateTimeToOccurrenceDate,
  toDateOnly,
} from '../common/utils/date.util';
import {
  buildOccurrenceMap,
  expandRecurrenceDates,
} from '../common/utils/recurrence.util';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarQueryDto } from './dto/calendar-query.dto';

const includeForCalendar = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(userId: string, query: CalendarQueryDto) {
    const rangeStart = parseDateOnly(query.startDate);
    const rangeEnd = parseDateOnly(query.endDate);

    if (rangeEnd < rangeStart) {
      throw new BadRequestException('endDate must be later than startDate.');
    }

    const [events, tasks] = await Promise.all([
      this.prisma.event.findMany({
        where: { userId },
        include: {
          ...includeForCalendar,
          occurrences: {
            where: {
              occurrenceDate: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
          },
        },
      }),
      this.prisma.task.findMany({
        where: { userId },
        include: {
          ...includeForCalendar,
          occurrences: {
            where: {
              occurrenceDate: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
          },
        },
      }),
    ]);

    const items = [
      ...events.flatMap((event) => {
        if (event.recurrenceRule) {
          const occurrenceMap = buildOccurrenceMap(event.occurrences);
          return expandRecurrenceDates(
            parseDateOnly(toDateOnly(event.startAt)),
            event.recurrenceRule,
            rangeStart,
            rangeEnd,
          ).map((occurrenceDate) => {
            const occurrenceKey = toDateOnly(occurrenceDate);
            const occurrence = occurrenceMap.get(occurrenceKey);
            return {
              type: 'event' as const,
              id: event.id,
              occurrenceDate: occurrenceKey,
              title: event.title,
              description: event.description,
              startAt: shiftDateTimeToOccurrenceDate(
                event.startAt,
                occurrenceDate,
              ),
              endAt: shiftDateTimeToOccurrenceDate(event.endAt, occurrenceDate),
              status: occurrence?.status ?? event.status,
              priority: event.priority,
              category: event.category,
              isRecurring: true,
            };
          });
        }

        const rangeEndExclusive = addUtcDays(rangeEnd, 1);
        if (event.startAt >= rangeEndExclusive || event.endAt < rangeStart) {
          return [];
        }

        return [
          {
            type: 'event' as const,
            id: event.id,
            occurrenceDate: toDateOnly(event.startAt),
            title: event.title,
            description: event.description,
            startAt: event.startAt,
            endAt: event.endAt,
            status: event.status,
            priority: event.priority,
            category: event.category,
            isRecurring: false,
          },
        ];
      }),
      ...tasks.flatMap((task) => {
        if (task.recurrenceRule && task.dueDate) {
          const occurrenceMap = buildOccurrenceMap(task.occurrences);
          return expandRecurrenceDates(
            task.dueDate,
            task.recurrenceRule,
            rangeStart,
            rangeEnd,
          ).map((occurrenceDate) => {
            const occurrenceKey = toDateOnly(occurrenceDate);
            const occurrence = occurrenceMap.get(occurrenceKey);
            return {
              type: 'task' as const,
              id: task.id,
              occurrenceDate: occurrenceKey,
              title: task.title,
              description: task.description,
              dueDate: occurrenceKey,
              status: occurrence?.status ?? task.status,
              priority: task.priority,
              category: task.category,
              isRecurring: true,
            };
          });
        }

        if (
          !task.dueDate ||
          task.dueDate < rangeStart ||
          task.dueDate > rangeEnd
        ) {
          return [];
        }

        return [
          {
            type: 'task' as const,
            id: task.id,
            occurrenceDate: toDateOnly(task.dueDate),
            title: task.title,
            description: task.description,
            dueDate: toDateOnly(task.dueDate),
            status: task.status,
            priority: task.priority,
            category: task.category,
            isRecurring: false,
          },
        ];
      }),
    ].sort((a, b) => {
      const aTime =
        a.type === 'event'
          ? a.startAt.getTime()
          : parseDateOnly(a.occurrenceDate).getTime();
      const bTime =
        b.type === 'event'
          ? b.startAt.getTime()
          : parseDateOnly(b.occurrenceDate).getTime();

      return aTime - bTime;
    });

    return { items };
  }
}
