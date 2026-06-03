import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentsModule } from '../agents/agents.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { AgentRunEntity } from './agent-run.entity';
import { MultiAgentOrchestratorService } from './multi-agent-orchestrator.service';
import { PipelineRunEntity } from './pipeline-run.entity';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentRunEntity, PipelineRunEntity]),
    AgentsModule,
    SchedulerModule,
  ],
  controllers: [PipelinesController],
  providers: [PipelinesService, MultiAgentOrchestratorService],
})
export class PipelinesModule {}
