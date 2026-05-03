import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { CalendarController } from '../src/calendar/calendar.controller';
import { CalendarService } from '../src/calendar/calendar.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CalendarController (e2e)', () => {
  let app: INestApplication<App>;
  type CalendarResponseBody = {
    items: unknown[];
  };
  type RequestWithUser = {
    user?: {
      userId: string;
      email: string;
    };
  };
  const prismaMock = {
    event: {
      findMany: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaMock.event.findMany.mockResolvedValue([
      {
        id: 'event-one',
        userId: 'user-one',
        title: 'Workout',
        description: 'Gym session',
        startAt: new Date('2026-05-04T09:00:00.000Z'),
        endAt: new Date('2026-05-04T10:00:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: null,
        category: { id: 'category-health', name: 'Health', color: '#22c55e' },
        occurrences: [],
      },
      {
        id: 'event-recurring',
        userId: 'user-one',
        title: 'Weekly review',
        description: null,
        startAt: new Date('2026-05-05T08:00:00.000Z'),
        endAt: new Date('2026-05-05T09:00:00.000Z'),
        status: 'pending',
        priority: 'high',
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['TUE'],
          endDate: '2026-05-31',
        },
        category: null,
        occurrences: [
          {
            occurrenceDate: new Date('2026-05-12T00:00:00.000Z'),
            status: 'completed',
          },
        ],
      },
    ]);

    prismaMock.task.findMany.mockResolvedValue([
      {
        id: 'task-one',
        userId: 'user-one',
        title: 'Buy milk',
        description: null,
        dueDate: new Date('2026-05-04T00:00:00.000Z'),
        status: 'completed',
        priority: 'low',
        recurrenceRule: null,
        category: null,
        occurrences: [],
      },
      {
        id: 'task-recurring',
        userId: 'user-one',
        title: 'Medication',
        description: 'Morning',
        dueDate: new Date('2026-05-05T00:00:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: {
          frequency: 'daily',
          interval: 2,
          endDate: '2026-05-09',
        },
        category: null,
        occurrences: [
          {
            occurrenceDate: new Date('2026-05-07T00:00:00.000Z'),
            status: 'skipped',
          },
        ],
      },
    ]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [
        CalendarService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest<RequestWithUser>();
          request.user = {
            userId: 'user-one',
            email: 'user@example.com',
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await app.close();
  });

  it('returns events, tasks, recurring occurrences, and occurrence status overrides in one items array', async () => {
    const response = await request(app.getHttpServer())
      .get('/calendar')
      .query({ startDate: '2026-05-04', endDate: '2026-05-12' })
      .expect(200);
    const body = response.body as CalendarResponseBody;

    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'event',
          id: 'event-one',
          occurrenceDate: '2026-05-04',
          status: 'pending',
          isRecurring: false,
        }),
        expect.objectContaining({
          type: 'task',
          id: 'task-one',
          occurrenceDate: '2026-05-04',
          dueDate: '2026-05-04',
          status: 'completed',
          isRecurring: false,
        }),
        expect.objectContaining({
          type: 'event',
          id: 'event-recurring',
          occurrenceDate: '2026-05-12',
          status: 'completed',
          isRecurring: true,
        }),
        expect.objectContaining({
          type: 'task',
          id: 'task-recurring',
          occurrenceDate: '2026-05-07',
          status: 'skipped',
          isRecurring: true,
        }),
      ]),
    );
    expect(body.items).toHaveLength(7);
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-one' } }),
    );
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-one' } }),
    );
  });

  it('rejects non date-only calendar query values', async () => {
    await request(app.getHttpServer())
      .get('/calendar')
      .query({
        startDate: '2026-05-04T00:00:00.000Z',
        endDate: '2026-05-12',
      })
      .expect(400);
  });
});
