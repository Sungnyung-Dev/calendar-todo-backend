import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateOccurrenceStatusDto } from '../common/dto/occurrence-status.dto';
import { UpdateStatusDto } from '../common/dto/status.dto';
import { parseDateOnly } from '../common/utils/date.util';
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
        recurrenceEndDate: dto.recurrenceRule?.endDate
          ? parseDateOnly(dto.recurrenceRule.endDate)
          : undefined,
      },
      include: eventInclude,
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.event.delete({ where: { id } });

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
    await this.ensureOwned(userId, id);
    const occurrenceDate = parseDateOnly(dto.occurrenceDate);

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

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (!value) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
