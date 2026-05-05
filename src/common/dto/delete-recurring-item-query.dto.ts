import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';

export enum DeleteRecurringItemScope {
  all = 'all',
  this = 'this',
  thisAndFuture = 'this-and-future',
}

export class DeleteRecurringItemQueryDto {
  @ApiPropertyOptional({
    enum: DeleteRecurringItemScope,
    default: DeleteRecurringItemScope.all,
    description:
      'all deletes the source item, this cancels one occurrence, this-and-future ends recurrence before occurrenceDate.',
  })
  @IsOptional()
  @IsEnum(DeleteRecurringItemScope)
  scope?: DeleteRecurringItemScope;

  @ApiPropertyOptional({
    example: '2026-05-11',
    description:
      'Required when scope is this or this-and-future. Must be an actual recurrence occurrence date.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString()
  occurrenceDate?: string;
}
