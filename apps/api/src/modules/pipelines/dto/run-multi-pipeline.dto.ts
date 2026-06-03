import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RunMultiPipelineDto {
  @ApiProperty({
    example: 'Add JWT refresh token support to the auth module',
    description: 'Task description for the multi-agent pipeline',
  })
  @IsString()
  @IsNotEmpty()
  task!: string;
}
