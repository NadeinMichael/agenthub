import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { UserEntity } from '../users/user.entity';

export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

@Entity('agents')
@Unique('UQ_agents_userId_name', ['userId', 'name'])
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: 'text' })
  description!: string | null;

  @Column({ type: 'enum', enum: AgentStatus, default: AgentStatus.INACTIVE })
  status!: AgentStatus;

  @Column({ type: 'jsonb', nullable: true })
  config!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  schedule!: string | null;

  @Column()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @CreateDateColumn()
  createdAt!: Date;
}
