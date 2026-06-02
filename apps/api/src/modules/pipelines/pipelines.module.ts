import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentsModule } from '../agents/agents.module';
import { AgentExecutorService } from './agent-executor.service';
import { AgentRunEntity } from './agent-run.entity';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentRunEntity]),
    AgentsModule,
  ],
  controllers: [PipelinesController],
  providers: [PipelinesService, AgentExecutorService],
})
export class PipelinesModule {}
