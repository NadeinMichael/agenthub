import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import type { AgentRunEntity } from './agent-run.entity';

export enum PipelineRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface PipelineAgentResults {
  research: string;
  code: string;
  review: string;
  final: string;
}

@Entity('pipeline_runs')
export class PipelineRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  task!: string;

  @Column({
    type: 'enum',
    enum: PipelineRunStatus,
    default: PipelineRunStatus.RUNNING,
  })
  status!: PipelineRunStatus;

  @Column({ type: 'jsonb', nullable: true })
  agentResults!: PipelineAgentResults | null;

  @OneToMany('AgentRunEntity', 'pipelineRun')
  agentRuns!: AgentRunEntity[];

  @CreateDateColumn()
  createdAt!: Date;
}
