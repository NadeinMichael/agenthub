import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RunPipelineDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'Agent ID to execute' })
  @IsUUID()
  agentId!: string;

  @ApiProperty({ example: 'Analyse the users table and return a summary', description: 'Task for the agent' })
  @IsString()
  @IsNotEmpty()
  task!: string;
}
