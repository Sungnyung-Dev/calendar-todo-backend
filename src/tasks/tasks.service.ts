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
    this.ensureRecurringTaskHasDueDate({
      ...dto,
      dueDate:
        dto.dueDate ?? (task.dueDate ? task.dueDate.toISOString() : undefined),
    });

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : undefined,
        categoryId: dto.categoryId,
        priority: dto.priority,
        recurrenceRule: this.toJson(dto.recurrenceRule),
        recurrenceEndDate: dto.recurrenceRule?.endDate
          ? parseDateOnly(dto.recurrenceRule.endDate)
          : undefined,
      },
      include: taskInclude,
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.task.delete({ where: { id } });

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
    await this.ensureOwned(userId, id);
    const occurrenceDate = parseDateOnly(dto.occurrenceDate);

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

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (!value) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
