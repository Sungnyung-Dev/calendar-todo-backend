import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, Matches } from 'class-validator';
import { ItemStatus } from '../enums/item-status.enum';

export class UpdateOccurrenceStatusDto {
  @ApiProperty({ example: '2026-05-04' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  occurrenceDate: string;

  @ApiProperty({ enum: ItemStatus, example: ItemStatus.skipped })
  @IsEnum(ItemStatus)
  status: ItemStatus;
}
