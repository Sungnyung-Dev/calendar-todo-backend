import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  SearchEventItemDto,
  SearchResponseDto,
  SearchTaskItemDto,
} from './dto/search-response.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@ApiExtraModels(SearchEventItemDto, SearchTaskItemDto)
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOkResponse({
    description: 'Searches events and tasks in one result set.',
    type: SearchResponseDto,
  })
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    return this.searchService.search(user.userId, query);
  }
}
