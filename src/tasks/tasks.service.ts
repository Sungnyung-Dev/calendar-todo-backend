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
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskInclude = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        ...taskInclude,
        occurrences: {
          orderBy: { occurrenceDate: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return task;
  }

  async create(userId: string, dto: CreateTaskDto) {
    await this.ensureCategoryOwned(userId, dto.categoryId);
    this.ensureRecurringTaskHasDueDate(dto);
    if (dto.dueDate) {
      this.ensureValidRecurrenceEndDate(
        dto.recurrenceRule,
        parseDateOnly(dto.dueDate),
      );
    }

    return this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : null,
        categoryId: dto.categoryId,
        priority: dto.priority,
        recurrenceRule: this.toJson(dto.recurrenceRule),
        recurrenceEndDate: dto.recurrenceRule?.endDate
          ? parseDateOnly(dto.recurrenceRule.endDate)
          : null,
      },
      include: taskInclude,
    });
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.ensureOwned(userId, id);
    await this.ensureCategoryOwned(userId, dto.categoryId);
    const nextDueDate = dto.dueDate
      ? parseDateOnly(dto.dueDate)
      : task.dueDate;
    const nextRecurrenceRule =
      dto.recurrenceRule === undefined
        ? task.recurrenceRule
        : dto.recurrenceRule;
    this.ensureRecurringTaskHasDueDate({
      ...dto,
      dueDate:
        dto.dueDate ?? (task.dueDate ? task.dueDate.toISOString() : undefined),
    });
    if (nextDueDate) {
      this.ensureValidRecurrenceEndDate(nextRecurrenceRule, nextDueDate);
    }
    const recurrenceRuleWasProvided = dto.recurrenceRule !== undefined;

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : undefined,
        categoryId: dto.categoryId,
        priority: dto.priority,
        recurrenceRule: this.toJson(dto.recurrenceRule),
        recurrenceEndDate: recurrenceRuleWasProvided
          ? dto.recurrenceRule?.endDate
            ? parseDateOnly(dto.recurrenceRule.endDate)
            : null
          : undefined,
      },
      include: taskInclude,
    });
  }

  async remove(
    userId: string,
    id: string,
    query: DeleteRecurringItemQueryDto = {},
  ) {
    const task = await this.ensureOwned(userId, id);
    const scope = query.scope ?? DeleteRecurringItemScope.all;

    if (!task.recurrenceRule) {
      if (scope !== DeleteRecurringItemScope.all) {
        throw new BadRequestException(
          'Recurring delete scope requires a recurring task.',
        );
      }

      await this.prisma.task.delete({ where: { id } });

      return { deleted: true };
    }

    if (scope === DeleteRecurringItemScope.all) {
      await this.prisma.task.delete({ where: { id } });

      return { deleted: true };
    }

    if (!query.occurrenceDate) {
      throw new BadRequestException(
        'occurrenceDate is required for this delete scope.',
      );
    }

    if (!task.dueDate) {
      throw new BadRequestException('Recurring tasks require dueDate.');
    }

    const occurrenceDate = parseDateOnly(query.occurrenceDate);
    this.ensureValidOccurrenceDate(
      task.dueDate,
      task.recurrenceRule,
      occurrenceDate,
    );

    if (scope === DeleteRecurringItemScope.this) {
      await this.prisma.taskOccurrence.upsert({
        where: {
          taskId_occurrenceDate: {
            taskId: id,
            occurrenceDate,
          },
        },
        create: {
          userId,
          taskId: id,
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
      ...this.toJsonObject(task.recurrenceRule),
      endDate: toDateOnly(recurrenceEndDate),
    };

    await this.prisma.task.update({
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

    return this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: taskInclude,
    });
  }

  async updateOccurrenceStatus(
    userId: string,
    id: string,
    dto: UpdateOccurrenceStatusDto,
  ) {
    const task = await this.ensureOwned(userId, id);
    if (!task.recurrenceRule) {
      throw new BadRequestException(
        'Occurrence status updates require a recurring task.',
      );
    }
    if (!task.dueDate) {
      throw new BadRequestException('Recurring tasks require dueDate.');
    }

    const occurrenceDate = parseDateOnly(dto.occurrenceDate);
    this.ensureValidOccurrenceDate(
      task.dueDate,
      task.recurrenceRule,
      occurrenceDate,
    );

    return this.prisma.taskOccurrence.upsert({
      where: {
        taskId_occurrenceDate: {
          taskId: id,
          occurrenceDate,
        },
      },
      create: {
        userId,
        taskId: id,
        occurrenceDate,
        status: dto.status,
      },
      update: {
        status: dto.status,
      },
    });
  }

  private async ensureOwned(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found.');
    }

    return task;
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

  private ensureRecurringTaskHasDueDate(dto: {
    dueDate?: string;
    recurrenceRule?: unknown;
  }) {
    if (dto.recurrenceRule && !dto.dueDate) {
      throw new BadRequestException('Recurring tasks require dueDate.');
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
        'recurrenceRule.endDate cannot be earlier than task dueDate.',
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
