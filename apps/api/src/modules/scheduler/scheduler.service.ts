import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { IsNull, Not, type Repository } from 'typeorm';

import { AgentEntity } from '../agents/agent.entity';
import { AgentRunEntity, AgentRunStatus } from '../pipelines/agent-run.entity';
import { AgentExecutorService } from '../pipelines/agent-executor.service';

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    @InjectRepository(AgentRunEntity)
    private readonly runRepo: Repository<AgentRunEntity>,
    private readonly executor: AgentExecutorService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const agents = await this.agentRepo.find({
      where: { schedule: Not(IsNull()) },
    });

    for (const agent of agents) {
      if (agent.schedule) {
        this.registerJob(agent);
      }
    }

    this.logger.log(`Registered ${agents.length} scheduled agent(s)`);
  }

  registerJob(agent: AgentEntity): void {
    if (!agent.schedule) return;

    this.removeJobIfExists(agent.id);

    const job = new CronJob(agent.schedule, () => {
      void this.triggerRun(agent.id);
    });

    this.schedulerRegistry.addCronJob(agent.id, job);
    job.start();
    this.logger.log(`Registered cron "${agent.schedule}" for agent "${agent.name}"`);
  }

  removeJobIfExists(agentId: string): void {
    try {
      const job = this.schedulerRegistry.getCronJob(agentId);
      job.stop();
      this.schedulerRegistry.deleteCronJob(agentId);
    } catch {
      // Job does not exist — nothing to remove
    }
  }

  getRunsByAgent(agentId: string): Promise<AgentRunEntity[]> {
    return this.runRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    });
  }

  getRecentRunsByUser(userId: string, limit = 20): Promise<AgentRunEntity[]> {
    return this.runRepo
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.agent', 'agent')
      .where('agent.userId = :userId', { userId })
      .orderBy('run.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  private async triggerRun(agentId: string): Promise<void> {
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent) {
      this.logger.warn(`Scheduled run skipped — agent ${agentId} not found`);
      return;
    }

    const task = agent.description?.trim() || 'Check project status and report on changes';

    const run = await this.runRepo.save(
      this.runRepo.create({ agentId: agent.id, task, status: AgentRunStatus.PENDING }),
    );

    await this.runRepo.update(run.id, { status: AgentRunStatus.RUNNING });

    try {
      const result = await this.executor.execute(agent, task);
      await this.runRepo.update(run.id, { status: AgentRunStatus.COMPLETED, result });
      this.logger.log(`Scheduled run for agent "${agent.name}" completed`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.runRepo.update(run.id, { status: AgentRunStatus.FAILED, result: message });
      this.logger.error(`Scheduled run for agent "${agent.name}" failed: ${message}`);
    }
  }
}
