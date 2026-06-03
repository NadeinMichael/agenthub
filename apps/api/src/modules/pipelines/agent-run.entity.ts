import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AgentEntity } from '../agents/agent.entity';
import type { PipelineRunEntity } from './pipeline-run.entity';

export enum AgentRunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('agent_runs')
export class AgentRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  agentId!: string | null;

  @ManyToOne(() => AgentEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'agentId' })
  agent!: AgentEntity | null;

  @Column({ nullable: true })
  pipelineRunId!: string | null;

  @ManyToOne('PipelineRunEntity', 'agentRuns', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pipelineRunId' })
  pipelineRun!: PipelineRunEntity | null;

  @Column({ type: 'text', nullable: true })
  agentRole!: string | null;

  @Column({ type: 'text' })
  task!: string;

  @Column({ type: 'text', nullable: true })
  result!: string | null;

  @Column({ type: 'enum', enum: AgentRunStatus, default: AgentRunStatus.PENDING })
  status!: AgentRunStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
