import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { AgentsService } from '../agents/agents.service';
import { AgentExecutorService } from './agent-executor.service';
import { AgentRunEntity, AgentRunStatus } from './agent-run.entity';
import type { RunPipelineDto } from './dto/run-pipeline.dto';

@Injectable()
export class PipelinesService {
  constructor(
    @InjectRepository(AgentRunEntity)
    private readonly runRepo: Repository<AgentRunEntity>,
    private readonly agentsService: AgentsService,
    private readonly executor: AgentExecutorService,
  ) {}

  async run(userId: string, dto: RunPipelineDto): Promise<AgentRunEntity> {
    const agent = await this.agentsService.findOne(dto.agentId, userId);

    const run = await this.runRepo.save(
      this.runRepo.create({
        agentId: agent.id,
        task: dto.task,
        status: AgentRunStatus.PENDING,
      }),
    );

    await this.runRepo.update(run.id, { status: AgentRunStatus.RUNNING });

    try {
      const result = await this.executor.execute(agent, dto.task);
      await this.runRepo.update(run.id, {
        status: AgentRunStatus.COMPLETED,
        result,
      });
      return this.runRepo.findOneByOrFail({ id: run.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runRepo.update(run.id, {
        status: AgentRunStatus.FAILED,
        result: message,
      });
      return this.runRepo.findOneByOrFail({ id: run.id });
    }
  }
}
