import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SearchQueryDto {
  @ApiProperty({ example: 'workout' })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  q: string;
}
