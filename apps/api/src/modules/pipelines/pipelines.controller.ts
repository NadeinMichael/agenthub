import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RunMultiPipelineDto } from './dto/run-multi-pipeline.dto';
import { RunPipelineDto } from './dto/run-pipeline.dto';
import { MultiAgentOrchestratorService } from './multi-agent-orchestrator.service';
import { PipelinesService } from './pipelines.service';

@ApiTags('Pipelines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@Controller('pipelines')
export class PipelinesController {
  constructor(
    private readonly pipelinesService: PipelinesService,
    private readonly orchestrator: MultiAgentOrchestratorService,
  ) {}

  @Post('run')
  @ApiOperation({ summary: 'Run a single agent against a task' })
  @ApiCreatedResponse({ description: 'Agent run result with status and output' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  run(@CurrentUser() user: JwtUser, @Body() dto: RunPipelineDto) {
    return this.pipelinesService.run(user.id, dto);
  }

  @Post('run-multi')
  @ApiOperation({
    summary: 'Run a multi-agent pipeline (Research + Code + Review → Orchestrator)',
    description:
      'Launches ResearchAgent, CodeAgent, and ReviewAgent in parallel via Promise.all. ' +
      'All three agent_runs are persisted to the DB with a shared pipeline_run_id. ' +
      'The Orchestrator synthesises their results into a final implementation plan.',
  })
  @ApiCreatedResponse({ description: 'PipelineRun with agentResults and linked agent_runs' })
  runMulti(@Body() dto: RunMultiPipelineDto) {
    return this.orchestrator.runMulti(dto.task);
  }
}
