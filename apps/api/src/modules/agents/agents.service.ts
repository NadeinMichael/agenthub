import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { QueryFailedError, Repository } from 'typeorm';

import { SchedulerService } from '../scheduler/scheduler.service';
import { AgentEntity } from './agent.entity';
import type { CreateAgentDto } from './dto/create-agent.dto';
import type { UpdateAgentDto } from './dto/update-agent.dto';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly schedulerService: SchedulerService,
  ) {}

  async create(userId: string, dto: CreateAgentDto): Promise<AgentEntity> {
    const agent = this.agentRepo.create({ ...dto, userId });
    try {
      const saved = await this.agentRepo.save(agent);
      if (saved.schedule) {
        this.schedulerService.registerJob(saved);
      }
      return saved;
    } catch (err) {
      if ((err as QueryFailedError & { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(`Agent with name "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  findAllByUser(userId: string): Promise<AgentEntity[]> {
    return this.agentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOneBy({ id });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    if (agent.userId !== userId) throw new ForbiddenException();
    return agent;
  }

  async update(id: string, userId: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const agent = await this.findOne(id, userId);
    Object.assign(agent, dto);
    try {
      const saved = await this.agentRepo.save(agent);
      if ('schedule' in dto) {
        if (saved.schedule) {
          this.schedulerService.registerJob(saved);
        } else {
          this.schedulerService.removeJobIfExists(id);
        }
      }
      return saved;
    } catch (err) {
      if ((err as QueryFailedError & { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(`Agent with name "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    const agent = await this.findOne(id, userId);
    this.schedulerService.removeJobIfExists(id);
    await this.agentRepo.remove(agent);
  }
}
