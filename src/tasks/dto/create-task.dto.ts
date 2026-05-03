import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RecurrenceRuleDto } from '../../common/dto/recurrence-rule.dto';
import { Priority } from '../../common/enums/priority.enum';

export class CreateTaskDto {
  @ApiProperty({ example: 'Buy milk' })
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional({ example: 'On the way home' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-05-04' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'categoryId' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ enum: Priority, example: Priority.medium })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ type: RecurrenceRuleDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  recurrenceRule?: RecurrenceRuleDto;
}
