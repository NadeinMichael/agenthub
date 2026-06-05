import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgentRunEntity } from '../pipelines/agent-run.entity';
import { SchedulerService } from '../scheduler/scheduler.service';
import { AgentEntity } from './agent.entity';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: 'Agent created', type: AgentEntity })
  @ApiConflictResponse({ description: 'Agent with this name already exists' })
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateAgentDto): Promise<AgentEntity> {
    return this.agentsService.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'List of agents for the current user', type: [AgentEntity] })
  findAll(@CurrentUser() user: JwtUser): Promise<AgentEntity[]> {
    return this.agentsService.findAllByUser(user.id);
  }

  @Get('runs')
  @ApiOkResponse({ description: 'Last 20 runs across all agents for the current user', type: [AgentRunEntity] })
  getRecentRuns(@CurrentUser() user: JwtUser): Promise<AgentRunEntity[]> {
    return this.schedulerService.getRecentRunsByUser(user.id);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Agent details', type: AgentEntity })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  @ApiForbiddenResponse({ description: 'Agent belongs to another user' })
  findOne(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgentEntity> {
    return this.agentsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Agent updated', type: AgentEntity })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  @ApiForbiddenResponse({ description: 'Agent belongs to another user' })
  @ApiConflictResponse({ description: 'Agent with this name already exists' })
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentEntity> {
    return this.agentsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Agent deleted' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  @ApiForbiddenResponse({ description: 'Agent belongs to another user' })
  remove(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.agentsService.remove(id, user.id);
  }

  @Get(':id/runs')
  @ApiOkResponse({ description: 'Run history for the agent', type: [AgentRunEntity] })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  @ApiForbiddenResponse({ description: 'Agent belongs to another user' })
  async getRuns(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AgentRunEntity[]> {
    await this.agentsService.findOne(id, user.id);
    return this.schedulerService.getRunsByAgent(id);
  }
}
