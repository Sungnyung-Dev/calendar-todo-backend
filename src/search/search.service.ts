import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

const includeCategory = {
  category: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: SearchQueryDto) {
    const keyword = query.q.trim();
    if (!keyword) {
      throw new BadRequestException('q must not be empty.');
    }

    const [events, tasks] = await Promise.all([
      this.prisma.event.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        },
        include: includeCategory,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: keyword } },
            { description: { contains: keyword } },
          ],
        },
        include: includeCategory,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      items: [
        ...events.map((event) => ({
          type: 'event' as const,
          ...event,
        })),
        ...tasks.map((task) => ({
          type: 'task' as const,
          ...task,
        })),
      ],
    };
  }
}
