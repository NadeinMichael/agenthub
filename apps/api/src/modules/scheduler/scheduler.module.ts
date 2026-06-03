import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AgentEntity } from '../agents/agent.entity';
import { AgentExecutorService } from '../pipelines/agent-executor.service';
import { AgentRunEntity } from '../pipelines/agent-run.entity';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([AgentEntity, AgentRunEntity]),
  ],
  providers: [SchedulerService, AgentExecutorService],
  exports: [SchedulerService, AgentExecutorService],
})
export class SchedulerModule {}
