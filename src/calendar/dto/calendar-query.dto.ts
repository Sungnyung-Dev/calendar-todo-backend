import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class CalendarQueryDto {
  @ApiProperty({ example: '2026-05-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-05-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  endDate: string;
}
