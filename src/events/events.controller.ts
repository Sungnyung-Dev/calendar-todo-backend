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
  @ApiOkResponse({ description: 'Returns events owned by the current user.' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.eventsService.findAll(user.userId);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Returns one event.' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.findOne(user.userId, id);
  }

  @Post()
  @ApiCreatedResponse({ description: 'Creates an event.' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Updates an event.' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Hard deletes an event.' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.remove(user.userId, id);
  }

  @Patch(':id/status')
  @ApiOkResponse({ description: 'Updates the event source status.' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.eventsService.updateStatus(user.userId, id, dto);
  }

  @Patch(':id/occurrences/status')
  @ApiOkResponse({
    description: 'Updates one recurring event occurrence status.',
  })
  updateOccurrenceStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOccurrenceStatusDto,
  ) {
    return this.eventsService.updateOccurrenceStatus(user.userId, id, dto);
  }
}
