import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  DeleteRecurringItemQueryDto,
  DeleteRecurringItemScope,
} from '../common/dto/delete-recurring-item-query.dto';
import {
  DeletedResponseDto,
  EventOccurrenceStatusResponseDto,
  EventResponseDto,
} from '../common/dto/common-response.dto';
import { UpdateOccurrenceStatusDto } from '../common/dto/occurrence-status.dto';
import { UpdateStatusDto } from '../common/dto/status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthUser } from '../common/types/auth-user.type';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Returns events owned by the current user.',
    type: [EventResponseDto],
  })
  findAll(@CurrentUser() user: AuthUser) {
    return this.eventsService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Returns one event.', type: EventResponseDto })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.findOne(user.userId, id);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Creates an event.',
    type: EventResponseDto,
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updates an event.', type: EventResponseDto })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: DeleteRecurringItemScope,
    description:
      'Recurring delete scope. all deletes the source event, this cancels one occurrence, this-and-future ends recurrence before occurrenceDate. Defaults to all.',
  })
  @ApiQuery({
    name: 'occurrenceDate',
    required: false,
    example: '2026-05-11',
    description:
      'Required for scope=this or scope=this-and-future. Must be YYYY-MM-DD and an actual recurrence occurrence date.',
  })
  @ApiOkResponse({
    description:
      'Deletes an event. Recurring events can delete all, one occurrence, or this-and-future using query parameters.',
    schema: {
      example: { deleted: true },
    },
    type: DeletedResponseDto,
  })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: DeleteRecurringItemQueryDto,
  ) {
    return this.eventsService.remove(user.userId, id, query);
  }

  @Patch(':id/status')
  @ApiOkResponse({
    description: 'Updates the event source status.',
    type: EventResponseDto,
  })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.eventsService.updateStatus(user.userId, id, dto);
  }

  @Patch(':id/occurrences/status')
  @ApiOkResponse({
    description:
      'Updates one recurring event occurrence status. occurrenceDate must be an actual generated recurrence date.',
    type: EventOccurrenceStatusResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Returned when the event is not recurring, occurrenceDate is outside the recurrence range, or occurrenceDate does not match the recurrence rule.',
  })
  updateOccurrenceStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOccurrenceStatusDto,
  ) {
    return this.eventsService.updateOccurrenceStatus(user.userId, id, dto);
  }
}
