import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeleteRecurringItemQueryDto,
  DeleteRecurringItemScope,
} from '../common/dto/delete-recurring-item-query.dto';
import { UpdateOccurrenceStatusDto } from '../common/dto/occurrence-status.dto';
import { UpdateStatusDto } from '../common/dto/status.dto';
import { ItemStatus } from '../common/enums/item-status.enum';
import {
  addUtcDays,
  parseDateOnly,
  toDateOnly,
} from '../common/utils/date.util';
import { isRecurrenceOccurrenceDate } from '../common/utils/recurrence.util';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const eventInclude = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
};

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.event.findMany({
      where: { userId },
      include: eventInclude,
      orderBy: { startAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, userId },
      include: {
        ...eventInclude,
        occurrences: {
          orderBy: { occurrenceDate: 'asc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    return event;
  }

  async create(userId: string, dto: CreateEventDto) {
    await this.ensureCategoryOwned(userId, dto.categoryId);

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.ensureValidRange(startAt, endAt);
    this.ensureValidRecurrenceEndDate(
      dto.recurrenceRule,
      parseDateOnly(toDateOnly(startAt)),
    );

    return this.prisma.event.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        startAt,
        endAt,
        categoryId: dto.categoryId,
        priority: dto.priority,
        recurrenceRule: this.toJson(dto.recurrenceRule),
        recurrenceEndDate: dto.recurrenceRule?.endDate
          ? parseDateOnly(dto.recurrenceRule.endDate)
          : null,
      },
      include: eventInclude,
    });
  }

  async update(userId: string, id: string, dto: UpdateEventDto) {
    const event = await this.ensureOwned(userId, id);
    await this.ensureCategoryOwned(userId, dto.categoryId);

    const nextStartAt = dto.startAt ? new Date(dto.startAt) : event.startAt;
    const nextEndAt = dto.endAt ? new Date(dto.endAt) : event.endAt;
    this.ensureValidRange(nextStartAt, nextEndAt);
    const nextRecurrenceRule =
      dto.recurrenceRule === undefined
        ? event.recurrenceRule
        : dto.recurrenceRule;
    this.ensureValidRecurrenceEndDate(
      nextRecurrenceRule,
      parseDateOnly(toDateOnly(nextStartAt)),
    );
    const recurrenceRuleWasProvided = dto.recurrenceRule !== undefined;

    return this.prisma.event.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        startAt: dto.startAt ? nextStartAt : undefined,
        endAt: dto.endAt ? nextEndAt : undefined,
        categoryId: dto.categoryId,
        priority: dto.priority,
        recurrenceRule: this.toJson(dto.recurrenceRule),
        recurrenceEndDate: recurrenceRuleWasProvided
          ? dto.recurrenceRule?.endDate
            ? parseDateOnly(dto.recurrenceRule.endDate)
            : null
          : undefined,
      },
      include: eventInclude,
    });
  }

  async remove(
    userId: string,
    id: string,
    query: DeleteRecurringItemQueryDto = {},
  ) {
    const event = await this.ensureOwned(userId, id);
    const scope = query.scope ?? DeleteRecurringItemScope.all;

    if (!event.recurrenceRule) {
      if (scope !== DeleteRecurringItemScope.all) {
        throw new BadRequestException(
          'Recurring delete scope requires a recurring event.',
        );
      }

      await this.prisma.event.delete({ where: { id } });

      return { deleted: true };
    }

    if (scope === DeleteRecurringItemScope.all) {
      await this.prisma.event.delete({ where: { id } });

      return { deleted: true };
    }

    if (!query.occurrenceDate) {
      throw new BadRequestException(
        'occurrenceDate is required for this delete scope.',
      );
    }

    const occurrenceDate = parseDateOnly(query.occurrenceDate);
    this.ensureValidOccurrenceDate(
      parseDateOnly(toDateOnly(event.startAt)),
      event.recurrenceRule,
      occurrenceDate,
    );

    if (scope === DeleteRecurringItemScope.this) {
      await this.prisma.eventOccurrence.upsert({
        where: {
          eventId_occurrenceDate: {
            eventId: id,
            occurrenceDate,
          },
        },
        create: {
          userId,
          eventId: id,
          occurrenceDate,
          status: ItemStatus.cancelled,
        },
        update: {
          status: ItemStatus.cancelled,
        },
      });

      return { deleted: true };
    }

    const recurrenceEndDate = addUtcDays(occurrenceDate, -1);
    const nextRule = {
      ...this.toJsonObject(event.recurrenceRule),
      endDate: toDateOnly(recurrenceEndDate),
    };

    await this.prisma.event.update({
      where: { id },
      data: {
        recurrenceRule: this.toJson(nextRule),
        recurrenceEndDate,
      },
    });

    return { deleted: true };
  }

  async updateStatus(userId: string, id: string, dto: UpdateStatusDto) {
    await this.ensureOwned(userId, id);

    return this.prisma.event.update({
      where: { id },
      data: { status: dto.status },
      include: eventInclude,
    });
  }

  async updateOccurrenceStatus(
    userId: string,
    id: string,
    dto: UpdateOccurrenceStatusDto,
  ) {
    const event = await this.ensureOwned(userId, id);
    if (!event.recurrenceRule) {
      throw new BadRequestException(
        'Occurrence status updates require a recurring event.',
      );
    }

    const occurrenceDate = parseDateOnly(dto.occurrenceDate);
    this.ensureValidOccurrenceDate(
      parseDateOnly(toDateOnly(event.startAt)),
      event.recurrenceRule,
      occurrenceDate,
    );

    return this.prisma.eventOccurrence.upsert({
      where: {
        eventId_occurrenceDate: {
          eventId: id,
          occurrenceDate,
        },
      },
      create: {
        userId,
        eventId: id,
        occurrenceDate,
        status: dto.status,
      },
      update: {
        status: dto.status,
      },
    });
  }

  private async ensureOwned(userId: string, id: string) {
    const event = await this.prisma.event.findFirst({
      where: { id, userId },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    return event;
  }

  private async ensureCategoryOwned(userId: string, categoryId?: string) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }
  }

  private ensureValidRange(startAt: Date, endAt: Date) {
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be later than startAt.');
    }
  }

  private ensureValidRecurrenceEndDate(
    recurrenceRule: { endDate?: string } | unknown,
    baseDate: Date,
  ) {
    if (
      recurrenceRule &&
      typeof recurrenceRule === 'object' &&
      !Array.isArray(recurrenceRule) &&
      'endDate' in recurrenceRule &&
      typeof recurrenceRule.endDate === 'string' &&
      parseDateOnly(recurrenceRule.endDate) < baseDate
    ) {
      throw new BadRequestException(
        'recurrenceRule.endDate cannot be earlier than the event start date.',
      );
    }
  }

  private ensureValidOccurrenceDate(
    baseDate: Date,
    recurrenceRule: unknown,
    occurrenceDate: Date,
  ) {
    if (!isRecurrenceOccurrenceDate(baseDate, recurrenceRule, occurrenceDate)) {
      throw new BadRequestException(
        'occurrenceDate must be within the recurrence range and match the recurrence rule.',
      );
    }
  }

  private toJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid recurrenceRule.');
    }

    return value as Record<string, unknown>;
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (!value) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
