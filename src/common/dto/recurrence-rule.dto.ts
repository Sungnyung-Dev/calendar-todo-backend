import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export enum RecurrenceFrequency {
  daily = 'daily',
  weekly = 'weekly',
  monthly = 'monthly',
}

export enum DayOfWeek {
  SUN = 'SUN',
  MON = 'MON',
  TUE = 'TUE',
  WED = 'WED',
  THU = 'THU',
  FRI = 'FRI',
  SAT = 'SAT',
}

@ValidatorConstraint({ name: 'recurrenceDaysOfWeek', async: false })
export class RecurrenceDaysOfWeekConstraint
  implements ValidatorConstraintInterface
{
  validate(value: DayOfWeek[] | undefined, args: ValidationArguments) {
    const rule = args.object as RecurrenceRuleDto;

    if (value === undefined) {
      return true;
    }

    if (rule.frequency !== RecurrenceFrequency.weekly) {
      return false;
    }

    return Array.isArray(value) && value.length > 0;
  }

  defaultMessage() {
    return 'daysOfWeek is only allowed for weekly recurrences and cannot be empty when provided.';
  }
}

export class RecurrenceRuleDto {
  @ApiProperty({
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.weekly,
    description: 'Supported recurrence frequency.',
  })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Repeat interval. Must be an integer greater than or equal to 1.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  interval?: number;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    isArray: true,
    example: [DayOfWeek.MON, DayOfWeek.WED, DayOfWeek.FRI],
    description:
      'Optional weekly day selection. Allowed only when frequency=weekly; if provided, it must not be empty.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  @Validate(RecurrenceDaysOfWeekConstraint)
  daysOfWeek?: DayOfWeek[];

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'Optional inclusive recurrence end date in YYYY-MM-DD format. It cannot be earlier than the event start date or task due date.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  endDate?: string;
}
