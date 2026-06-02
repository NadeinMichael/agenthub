import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, type JwtUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RunPipelineDto } from './dto/run-pipeline.dto';
import { PipelinesService } from './pipelines.service';

@ApiTags('Pipelines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelinesService: PipelinesService) {}

  @Post('run')
  @ApiCreatedResponse({ description: 'Agent run result with status and output' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  run(@CurrentUser() user: JwtUser, @Body() dto: RunPipelineDto) {
    return this.pipelinesService.run(user.id, dto);
  }
}
