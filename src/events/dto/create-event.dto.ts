import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RecurrenceRuleDto } from '../../common/dto/recurrence-rule.dto';
import { Priority } from '../../common/enums/priority.enum';

export class CreateEventDto {
  @ApiProperty({ example: 'Workout' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({ example: 'Gym session' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-05-04T09:00:00.000Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2026-05-04T10:00:00.000Z' })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ example: 'categoryId' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: Priority, example: Priority.medium })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    type: RecurrenceRuleDto,
    description:
      'Optional recurrence rule. weekly may use daysOfWeek; daily/monthly must not. endDate cannot be earlier than startAt.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  recurrenceRule?: RecurrenceRuleDto;
}
