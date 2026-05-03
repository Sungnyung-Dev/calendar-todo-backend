import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    await this.ensureNameAvailable(userId, dto.name);

    return this.prisma.category.create({
      data: {
        userId,
        name: dto.name,
        color: dto.color,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto) {
    await this.ensureOwned(userId, id);

    if (dto.name) {
      await this.ensureNameAvailable(userId, dto.name, id);
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.category.delete({ where: { id } });

    return { deleted: true };
  }

  private async ensureOwned(userId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }
  }

  private async ensureNameAvailable(
    userId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.category.findFirst({
      where: {
        userId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Category name already exists.');
    }
  }
}
