import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ItemStatus } from '../enums/item-status.enum';

export class UpdateStatusDto {
  @ApiProperty({ enum: ItemStatus, example: ItemStatus.completed })
  @IsEnum(ItemStatus)
  status: ItemStatus;
}
