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
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    eventOccurrence: {
      upsert: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
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
        id: 'event-weekly',
        userId: 'user-one',
        categoryId: null,
        title: 'Weekly sync',
        description: null,
        startAt: new Date('2026-05-04T09:00:00.000Z'),
        endAt: new Date('2026-05-04T09:30:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['MON'],
          endDate: '2026-05-25',
        },
        recurrenceEndDate: new Date('2026-05-25T00:00:00.000Z'),
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
        id: 'task-weekly',
        userId: 'user-one',
        categoryId: null,
        title: 'Weekly review',
        description: null,
        dueDate: new Date('2026-05-04T00:00:00.000Z'),
        status: 'pending',
        priority: 'medium',
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['MON'],
          endDate: '2026-05-25',
        },
        recurrenceEndDate: new Date('2026-05-25T00:00:00.000Z'),
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
    prismaMock.event.create.mockImplementation(({ data }) => {
      const event: TestEvent = {
        id: `event-created-${events.length + 1}`,
        category: null,
        status: 'pending',
        priority: 'medium',
        description: null,
        categoryId: null,
        ...data,
      };
      events.push(event);
      return event;
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
    prismaMock.task.create.mockImplementation(({ data }) => {
      const task: TestTask = {
        id: `task-created-${tasks.length + 1}`,
        category: null,
        status: 'pending',
        priority: 'medium',
        description: null,
        categoryId: null,
        ...data,
      };
      tasks.push(task);
      return task;
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

  it('updates only valid recurring event occurrence dates', async () => {
    await request(app.getHttpServer())
      .patch('/events/event-weekly/occurrences/status')
      .send({ occurrenceDate: '2026-05-11', status: 'completed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/events/event-weekly/occurrences/status')
      .send({ occurrenceDate: '2026-05-12', status: 'completed' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/events/event-weekly/occurrences/status')
      .send({ occurrenceDate: '2026-06-01', status: 'completed' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/events/event-one/occurrences/status')
      .send({ occurrenceDate: '2026-05-10', status: 'completed' })
      .expect(400);
  });

  it('updates only valid recurring task occurrence dates', async () => {
    await request(app.getHttpServer())
      .patch('/tasks/task-weekly/occurrences/status')
      .send({ occurrenceDate: '2026-05-11', status: 'completed' })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/tasks/task-weekly/occurrences/status')
      .send({ occurrenceDate: '2026-05-12', status: 'completed' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/tasks/task-weekly/occurrences/status')
      .send({ occurrenceDate: '2026-06-01', status: 'completed' })
      .expect(400);

    await request(app.getHttpServer())
      .patch('/tasks/task-one/occurrences/status')
      .send({ occurrenceDate: '2026-05-10', status: 'completed' })
      .expect(400);
  });

  it('rejects invalid recurrence rule combinations and early end dates', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Invalid daily days',
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T10:00:00.000Z',
        recurrenceRule: {
          frequency: 'daily',
          daysOfWeek: ['MON'],
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Invalid monthly days',
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T10:00:00.000Z',
        recurrenceRule: {
          frequency: 'monthly',
          daysOfWeek: ['MON'],
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Empty weekly days',
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T10:00:00.000Z',
        recurrenceRule: {
          frequency: 'weekly',
          daysOfWeek: [],
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Early end event',
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T10:00:00.000Z',
        recurrenceRule: {
          frequency: 'daily',
          endDate: '2026-05-09',
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Early end task',
        dueDate: '2026-05-10',
        recurrenceRule: {
          frequency: 'daily',
          endDate: '2026-05-09',
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Recurring without due date',
        recurrenceRule: {
          frequency: 'daily',
        },
      })
      .expect(400);
  });

  it('keeps recurrenceRule.endDate and recurrenceEndDate synchronized on create and update', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({
        title: 'Created recurring event',
        startAt: '2026-05-10T09:00:00.000Z',
        endAt: '2026-05-10T10:00:00.000Z',
        recurrenceRule: {
          frequency: 'daily',
          endDate: '2026-05-20',
        },
      })
      .expect(201);

    const createdEvent = events.find(
      (event) => event.title === 'Created recurring event',
    );
    expect(createdEvent?.recurrenceRule?.endDate).toBe('2026-05-20');
    expect(createdEvent?.recurrenceEndDate?.toISOString()).toBe(
      '2026-05-20T00:00:00.000Z',
    );

    await request(app.getHttpServer())
      .patch('/events/event-weekly')
      .send({
        recurrenceRule: {
          frequency: 'weekly',
          daysOfWeek: ['MON'],
        },
      })
      .expect(200);
    expect(events.find((event) => event.id === 'event-weekly')?.recurrenceRule)
      .toEqual({
        frequency: 'weekly',
        daysOfWeek: ['MON'],
      });
    expect(
      events.find((event) => event.id === 'event-weekly')?.recurrenceEndDate,
    ).toBeNull();

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Created recurring task',
        dueDate: '2026-05-10',
        recurrenceRule: {
          frequency: 'daily',
          endDate: '2026-05-20',
        },
      })
      .expect(201);

    const createdTask = tasks.find(
      (task) => task.title === 'Created recurring task',
    );
    expect(createdTask?.recurrenceRule?.endDate).toBe('2026-05-20');
    expect(createdTask?.recurrenceEndDate?.toISOString()).toBe(
      '2026-05-20T00:00:00.000Z',
    );

    await request(app.getHttpServer())
      .patch('/tasks/task-weekly')
      .send({
        recurrenceRule: {
          frequency: 'weekly',
          daysOfWeek: ['MON'],
        },
      })
      .expect(200);
    expect(tasks.find((task) => task.id === 'task-weekly')?.recurrenceRule)
      .toEqual({
        frequency: 'weekly',
        daysOfWeek: ['MON'],
      });
    expect(
      tasks.find((task) => task.id === 'task-weekly')?.recurrenceEndDate,
    ).toBeNull();
  });
});
