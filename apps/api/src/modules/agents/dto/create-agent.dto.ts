import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

import { AgentStatus } from '../agent.entity';

export class CreateAgentDto {
  @ApiProperty({ example: 'My Assistant', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Handles customer queries' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: AgentStatus, default: AgentStatus.INACTIVE })
  @IsEnum(AgentStatus)
  @IsOptional()
  status?: AgentStatus;

  @ApiPropertyOptional({ example: { model: 'claude-sonnet-4-6', temperature: 0.7 } })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '0 9 * * 1-5', description: 'Cron expression for scheduled runs (null to disable)' })
  @IsString()
  @IsOptional()
  schedule?: string | null;
}
