import { ApiProperty } from '@nestjs/swagger';
import {
  EventResponseDto,
  TaskResponseDto,
} from '../../common/dto/common-response.dto';

export class SearchEventItemDto extends EventResponseDto {
  @ApiProperty({ example: 'event' })
  type: 'event';
}

export class SearchTaskItemDto extends TaskResponseDto {
  @ApiProperty({ example: 'task' })
  type: 'task';
}

export class SearchResponseDto {
  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/SearchEventItemDto' },
      { $ref: '#/components/schemas/SearchTaskItemDto' },
    ],
    isArray: true,
  })
  items: Array<SearchEventItemDto | SearchTaskItemDto>;
}
