import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CategoryResponseDto,
  DeletedResponseDto,
} from '../common/dto/common-response.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOkResponse({
    description: 'Returns categories owned by the current user.',
    type: [CategoryResponseDto],
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.categoriesService.findAll(user.userId);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Creates a category.',
    type: CategoryResponseDto,
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Updates a category.',
    type: CategoryResponseDto,
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Hard deletes a category.',
    type: DeletedResponseDto,
  })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.categoriesService.remove(user.userId, id);
  }
}
