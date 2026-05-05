import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CalendarController } from '../src/calendar/calendar.controller';
import { CalendarService } from '../src/calendar/calendar.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { EventsController } from '../src/events/events.controller';
import { EventsService } from '../src/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';

type RequestWithUser = {
  user?: {
    userId: string;
    email: string;
  };
};

type ItemStatus = 'pending' | 'completed' | 'cancelled' | 'skipped';

type RecurrenceRule = {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  daysOfWeek?: string[];
  endDate?: string;
};

type TestEvent = {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  status: ItemStatus;
  priority: 'low' | 'medium' | 'high';
  recurrenceRule: RecurrenceRule | null;
  recurrenceEndDate: Date | null;
  category: null;
};

type TestTask = {
  id: string;
  userId: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  dueDate: Date | null;
  status: ItemStatus;
  priority: 'low' | 'medium' | 'high';
  recurrenceRule: RecurrenceRule | null;
  recurrenceEndDate: Date | null;
  category: null;
};

type TestOccurrence = {
  id: string;
  userId: string;
  eventId?: string;
  taskId?: string;
  occurrenceDate: Date;
  status: ItemStatus;
};

const isWithinRange = (
  date: Date,
  range?: {
    gte?: Date;
    lte?: Date;
  },
) => (!range?.gte || date >= range.gte) && (!range?.lte || date <= range.lte);

describe('Recurring delete policy (e2e)', () => {
  let app: INestApplication<App>;
  let events: TestEvent[];
  let tasks: TestTask[];
  let eventOccurrences: TestOccurrence[];
  let taskOccurrences: TestOccurrence[];

  const prismaMock = {
    event: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    eventOccurrence: {
      upsert: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    taskOccurrence: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    events = [
      {
        id: 'event-recurring',
        userId: 'user-one',
        categoryId: null,
        title: 'Daily standup',
        description: null,
        startAt: new Date('2026-05-09T09:00:00.000Z'),
        endAt: new Date('2026-05-09T09:30:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: {
          frequency: 'daily',
          interval: 1,
          endDate: '2026-05-15',
        },
        recurrenceEndDate: new Date('2026-05-15T00:00:00.000Z'),
        category: null,
      },
      {
        id: 'event-one',
        userId: 'user-one',
        categoryId: null,
        title: 'One-time event',
        description: null,
        startAt: new Date('2026-05-10T12:00:00.000Z'),
        endAt: new Date('2026-05-10T13:00:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: null,
        recurrenceEndDate: null,
        category: null,
      },
    ];
    tasks = [
      {
        id: 'task-recurring',
        userId: 'user-one',
        categoryId: null,
        title: 'Daily task',
        description: null,
        dueDate: new Date('2026-05-09T00:00:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: {
          frequency: 'daily',
          interval: 1,
          endDate: '2026-05-15',
        },
        recurrenceEndDate: new Date('2026-05-15T00:00:00.000Z'),
        category: null,
      },
      {
        id: 'task-one',
        userId: 'user-one',
        categoryId: null,
        title: 'One-time task',
        description: null,
        dueDate: new Date('2026-05-10T00:00:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: null,
        recurrenceEndDate: null,
        category: null,
      },
    ];
    eventOccurrences = [];
    taskOccurrences = [];

    prismaMock.event.findFirst.mockImplementation(
      ({ where }) =>
        events.find(
          (event) => event.id === where.id && event.userId === where.userId,
        ) ?? null,
    );
    prismaMock.event.findMany.mockImplementation(({ where, include }) =>
      events
        .filter((event) => event.userId === where.userId)
        .map((event) => ({
          ...event,
          occurrences: eventOccurrences.filter(
            (occurrence) =>
              occurrence.eventId === event.id &&
              isWithinRange(
                occurrence.occurrenceDate,
                include.occurrences.where.occurrenceDate,
              ),
          ),
        })),
    );
    prismaMock.event.delete.mockImplementation(({ where }) => {
      events = events.filter((event) => event.id !== where.id);
      return { id: where.id };
    });
    prismaMock.event.update.mockImplementation(({ where, data }) => {
      const event = events.find((item) => item.id === where.id);
      if (!event) {
        throw new Error('event not found');
      }
      Object.assign(event, data);
      return event;
    });
    prismaMock.eventOccurrence.upsert.mockImplementation(
      ({ where, create, update }) => {
        let occurrence = eventOccurrences.find(
          (item) =>
            item.eventId === where.eventId_occurrenceDate.eventId &&
            item.occurrenceDate.getTime() ===
              where.eventId_occurrenceDate.occurrenceDate.getTime(),
        );
        if (occurrence) {
          Object.assign(occurrence, update);
        } else {
          occurrence = { id: 'event-occurrence', ...create };
          eventOccurrences.push(occurrence);
        }
        return occurrence;
      },
    );

    prismaMock.task.findFirst.mockImplementation(
      ({ where }) =>
        tasks.find(
          (task) => task.id === where.id && task.userId === where.userId,
        ) ?? null,
    );
    prismaMock.task.findMany.mockImplementation(({ where, include }) =>
      tasks
        .filter((task) => task.userId === where.userId)
        .map((task) => ({
          ...task,
          occurrences: taskOccurrences.filter(
            (occurrence) =>
              occurrence.taskId === task.id &&
              isWithinRange(
                occurrence.occurrenceDate,
                include.occurrences.where.occurrenceDate,
              ),
          ),
        })),
    );
    prismaMock.task.delete.mockImplementation(({ where }) => {
      tasks = tasks.filter((task) => task.id !== where.id);
      return { id: where.id };
    });
    prismaMock.task.update.mockImplementation(({ where, data }) => {
      const task = tasks.find((item) => item.id === where.id);
      if (!task) {
        throw new Error('task not found');
      }
      Object.assign(task, data);
      return task;
    });
    prismaMock.taskOccurrence.upsert.mockImplementation(
      ({ where, create, update }) => {
        let occurrence = taskOccurrences.find(
          (item) =>
            item.taskId === where.taskId_occurrenceDate.taskId &&
            item.occurrenceDate.getTime() ===
              where.taskId_occurrenceDate.occurrenceDate.getTime(),
        );
        if (occurrence) {
          Object.assign(occurrence, update);
        } else {
          occurrence = { id: 'task-occurrence', ...create };
          taskOccurrences.push(occurrence);
        }
        return occurrence;
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EventsController, TasksController, CalendarController],
      providers: [
        EventsService,
        TasksService,
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
          const req = context.switchToHttp().getRequest<RequestWithUser>();
          req.user = {
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

  it('deletes only one recurring event occurrence from calendar', async () => {
    await request(app.getHttpServer())
      .delete('/events/event-recurring')
      .query({ scope: 'this', occurrenceDate: '2026-05-11' })
      .expect(200)
      .expect({ deleted: true });

    const response = await request(app.getHttpServer())
      .get('/calendar')
      .query({ startDate: '2026-05-09', endDate: '2026-05-12' })
      .expect(200);

    const eventDates = response.body.items
      .filter(
        (item: { type: string; id: string }) => item.id === 'event-recurring',
      )
      .map((item: { occurrenceDate: string }) => item.occurrenceDate);

    expect(eventDates).toEqual(['2026-05-09', '2026-05-10', '2026-05-12']);
  });

  it('deletes this-and-future recurring event occurrences from calendar', async () => {
    await request(app.getHttpServer())
      .delete('/events/event-recurring')
      .query({ scope: 'this-and-future', occurrenceDate: '2026-05-11' })
      .expect(200)
      .expect({ deleted: true });

    const response = await request(app.getHttpServer())
      .get('/calendar')
      .query({ startDate: '2026-05-09', endDate: '2026-05-13' })
      .expect(200);

    const eventDates = response.body.items
      .filter((item: { id: string }) => item.id === 'event-recurring')
      .map((item: { occurrenceDate: string }) => item.occurrenceDate);

    expect(eventDates).toEqual(['2026-05-09', '2026-05-10']);
    expect(events[0].recurrenceRule?.endDate).toBe('2026-05-10');
    expect(events[0].recurrenceEndDate?.toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
  });

  it('deletes only one recurring task occurrence from calendar', async () => {
    await request(app.getHttpServer())
      .delete('/tasks/task-recurring')
      .query({ scope: 'this', occurrenceDate: '2026-05-11' })
      .expect(200)
      .expect({ deleted: true });

    const response = await request(app.getHttpServer())
      .get('/calendar')
      .query({ startDate: '2026-05-09', endDate: '2026-05-12' })
      .expect(200);

    const taskDates = response.body.items
      .filter((item: { id: string }) => item.id === 'task-recurring')
      .map((item: { occurrenceDate: string }) => item.occurrenceDate);

    expect(taskDates).toEqual(['2026-05-09', '2026-05-10', '2026-05-12']);
  });

  it('deletes this-and-future recurring task occurrences from calendar', async () => {
    await request(app.getHttpServer())
      .delete('/tasks/task-recurring')
      .query({ scope: 'this-and-future', occurrenceDate: '2026-05-11' })
      .expect(200)
      .expect({ deleted: true });

    const response = await request(app.getHttpServer())
      .get('/calendar')
      .query({ startDate: '2026-05-09', endDate: '2026-05-13' })
      .expect(200);

    const taskDates = response.body.items
      .filter((item: { id: string }) => item.id === 'task-recurring')
      .map((item: { occurrenceDate: string }) => item.occurrenceDate);

    expect(taskDates).toEqual(['2026-05-09', '2026-05-10']);
    expect(tasks[0].recurrenceRule?.endDate).toBe('2026-05-10');
    expect(tasks[0].recurrenceEndDate?.toISOString()).toBe(
      '2026-05-10T00:00:00.000Z',
    );
  });

  it('keeps non-recurring event and task hard delete behavior', async () => {
    await request(app.getHttpServer())
      .delete('/events/event-one')
      .expect(200)
      .expect({ deleted: true });
    await request(app.getHttpServer())
      .delete('/tasks/task-one')
      .expect(200)
      .expect({ deleted: true });

    expect(events.some((event) => event.id === 'event-one')).toBe(false);
    expect(tasks.some((task) => task.id === 'task-one')).toBe(false);
  });

  it('rejects invalid recurring delete query values', async () => {
    await request(app.getHttpServer())
      .delete('/events/event-recurring')
      .query({ scope: 'later', occurrenceDate: '2026-05-11' })
      .expect(400);

    await request(app.getHttpServer())
      .delete('/events/event-recurring')
      .query({ scope: 'this' })
      .expect(400);

    await request(app.getHttpServer())
      .delete('/events/event-one')
      .query({ scope: 'this', occurrenceDate: '2026-05-10' })
      .expect(400);

    await request(app.getHttpServer())
      .delete('/tasks/task-recurring')
      .query({ scope: 'this', occurrenceDate: '2026-05-20' })
      .expect(400);
  });
});
