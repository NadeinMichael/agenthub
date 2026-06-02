import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AgentEntity } from '../agents/agent.entity';

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

  @Column()
  agentId!: string;

  @ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agentId' })
  agent!: AgentEntity;

  @Column({ type: 'text' })
  task!: string;

  @Column({ type: 'text', nullable: true })
  result!: string | null;

  @Column({ type: 'enum', enum: AgentRunStatus, default: AgentRunStatus.PENDING })
  status!: AgentRunStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
