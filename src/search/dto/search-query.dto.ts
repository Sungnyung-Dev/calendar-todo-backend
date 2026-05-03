import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: 'workout' })
  @IsString()
  @MinLength(1)
  q: string;
}
