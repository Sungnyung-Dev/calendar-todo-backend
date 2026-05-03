import { ApiProperty } from '@nestjs/swagger';
import { ItemStatus } from '../enums/item-status.enum';
import { Priority } from '../enums/priority.enum';

export class DeletedResponseDto {
  @ApiProperty({ example: true })
  deleted: boolean;
}

export class CategorySummaryDto {
  @ApiProperty({ example: 'categoryId' })
  id: string;

  @ApiProperty({ example: 'Health' })
  name: string;

  @ApiProperty({ example: '#22c55e', nullable: true })
  color: string | null;
}

export class CategoryResponseDto extends CategorySummaryDto {
  @ApiProperty({ example: 'userId' })
  userId: string;

  @ApiProperty({ example: '2026-05-03T13:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-03T13:00:00.000Z' })
  updatedAt: Date;
}

export class UserProfileResponseDto {
  @ApiProperty({ example: 'userId' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'Jane Doe', nullable: true })
  name: string | null;

  @ApiProperty({ example: '2026-05-03T13:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-03T13:00:00.000Z' })
  updatedAt: Date;
}

export class OccurrenceStatusResponseDto {
  @ApiProperty({ example: 'occurrenceId' })
  id: string;

  @ApiProperty({ example: 'userId' })
  userId: string;

  @ApiProperty({ example: '2026-05-04T00:00:00.000Z' })
  occurrenceDate: Date;

  @ApiProperty({ enum: ItemStatus, example: ItemStatus.skipped })
  status: ItemStatus;
}

export class EventOccurrenceStatusResponseDto extends OccurrenceStatusResponseDto {
  @ApiProperty({ example: 'eventId' })
  eventId: string;
}

export class TaskOccurrenceStatusResponseDto extends OccurrenceStatusResponseDto {
  @ApiProperty({ example: 'taskId' })
  taskId: string;
}

export class EventResponseDto {
  @ApiProperty({ example: 'eventId' })
  id: string;

  @ApiProperty({ example: 'userId' })
  userId: string;

  @ApiProperty({ example: 'Workout' })
  title: string;

  @ApiProperty({ example: 'Gym session', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-05-04T09:00:00.000Z' })
  startAt: Date;

  @ApiProperty({ example: '2026-05-04T10:00:00.000Z' })
  endAt: Date;

  @ApiProperty({ enum: ItemStatus, example: ItemStatus.pending })
  status: ItemStatus;

  @ApiProperty({ enum: Priority, example: Priority.medium })
  priority: Priority;

  @ApiProperty({ type: CategorySummaryDto, nullable: true })
  category: CategorySummaryDto | null;
}

export class TaskResponseDto {
  @ApiProperty({ example: 'taskId' })
  id: string;

  @ApiProperty({ example: 'userId' })
  userId: string;

  @ApiProperty({ example: 'Buy milk' })
  title: string;

  @ApiProperty({ example: 'On the way home', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-05-04', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ enum: ItemStatus, example: ItemStatus.pending })
  status: ItemStatus;

  @ApiProperty({ enum: Priority, example: Priority.medium })
  priority: Priority;

  @ApiProperty({ type: CategorySummaryDto, nullable: true })
  category: CategorySummaryDto | null;
}
