import { ApiProperty } from '@nestjs/swagger';
import { CategorySummaryDto } from '../../common/dto/common-response.dto';
import { ItemStatus } from '../../common/enums/item-status.enum';
import { Priority } from '../../common/enums/priority.enum';

export class CalendarEventItemDto {
  @ApiProperty({ example: 'event' })
  type: 'event';

  @ApiProperty({ example: 'eventId' })
  id: string;

  @ApiProperty({ example: '2026-05-04' })
  occurrenceDate: string;

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

  @ApiProperty({ example: true })
  isRecurring: boolean;
}

export class CalendarTaskItemDto {
  @ApiProperty({ example: 'task' })
  type: 'task';

  @ApiProperty({ example: 'taskId' })
  id: string;

  @ApiProperty({ example: '2026-05-04' })
  occurrenceDate: string;

  @ApiProperty({ example: 'Buy milk' })
  title: string;

  @ApiProperty({ example: null, nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-05-04' })
  dueDate: string;

  @ApiProperty({ enum: ItemStatus, example: ItemStatus.completed })
  status: ItemStatus;

  @ApiProperty({ enum: Priority, example: Priority.low })
  priority: Priority;

  @ApiProperty({ type: CategorySummaryDto, nullable: true })
  category: CategorySummaryDto | null;

  @ApiProperty({ example: false })
  isRecurring: boolean;
}

export class CalendarResponseDto {
  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/CalendarEventItemDto' },
      { $ref: '#/components/schemas/CalendarTaskItemDto' },
    ],
    isArray: true,
  })
  items: Array<CalendarEventItemDto | CalendarTaskItemDto>;
}
