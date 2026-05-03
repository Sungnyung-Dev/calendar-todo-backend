import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';
import { ItemStatus } from '../enums/item-status.enum';

export class UpdateOccurrenceStatusDto {
  @ApiProperty({ example: '2026-05-04' })
  @IsDateString()
  occurrenceDate: string;

  @ApiProperty({ enum: ItemStatus, example: ItemStatus.skipped })
  @IsEnum(ItemStatus)
  status: ItemStatus;
}
