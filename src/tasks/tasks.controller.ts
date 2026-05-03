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
  DeletedResponseDto,
  TaskOccurrenceStatusResponseDto,
  TaskResponseDto,
} from '../common/dto/common-response.dto';
import { UpdateOccurrenceStatusDto } from '../common/dto/occurrence-status.dto';
import { UpdateStatusDto } from '../common/dto/status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOkResponse({
    description: 'Returns tasks owned by the current user.',
    type: [TaskResponseDto],
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.tasksService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Returns one task.', type: TaskResponseDto })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.findOne(user.userId, id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Creates a task.', type: TaskResponseDto })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updates a task.', type: TaskResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({
    description: 'Hard deletes a task.',
    type: DeletedResponseDto,
  })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasksService.remove(user.userId, id);
  }

  @Patch(':id/status')
  @ApiOkResponse({
    description: 'Updates the task source status.',
    type: TaskResponseDto,
  })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.tasksService.updateStatus(user.userId, id, dto);
  }

  @Patch(':id/occurrences/status')
  @ApiOkResponse({
    description: 'Updates one recurring task occurrence status.',
    type: TaskOccurrenceStatusResponseDto,
  })
  updateOccurrenceStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOccurrenceStatusDto,
  ) {
    return this.tasksService.updateOccurrenceStatus(user.userId, id, dto);
  }
}
