import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import type { Repository } from 'typeorm';

import { AgentExecutorService, DEFAULT_AGENT_MODEL, type AgentSpec } from './agent-executor.service';
import { AgentRunEntity, AgentRunStatus } from './agent-run.entity';
import { PipelineRunEntity, PipelineRunStatus } from './pipeline-run.entity';

const RESEARCH_AGENT: AgentSpec = {
  name: 'ResearchAgent',
  description: 'Reads and analyses project files relevant to the task.',
  config: {
    systemPrompt:
      'Use list_directory and read_file tools to explore the codebase. ' +
      'Find all files relevant to the given task and summarise their structure, ' +
      'key exports, and relationships. Include exact file paths and function names.',
  },
};

const CODE_AGENT: AgentSpec = {
  name: 'CodeAgent',
  description: 'Analyses existing code and proposes a concrete implementation.',
  config: {
    systemPrompt:
      'Use read_file and list_directory to understand the existing code structure. ' +
      'Then propose a detailed, file-by-file implementation plan with actual code snippets. ' +
      'Reference exact file paths and function signatures from the codebase.',
  },
};

const REVIEW_AGENT: AgentSpec = {
  name: 'ReviewAgent',
  description: 'Validates implementation proposals against project conventions.',
  config: {
    systemPrompt:
      'Start by calling read_file with path "CLAUDE.md" to load the project conventions. ' +
      'Then read the relevant source files for the task. ' +
      'Identify any violations of TypeScript strict mode, naming conventions, import style, ' +
      'or architectural rules and provide concrete corrective suggestions.',
  },
};

@Injectable()
export class MultiAgentOrchestratorService {
  private readonly logger = new Logger(MultiAgentOrchestratorService.name);
  private readonly groq = new Groq({ apiKey: process.env['GROQ_API_KEY'] });

  constructor(
    @InjectRepository(AgentRunEntity)
    private readonly runRepo: Repository<AgentRunEntity>,
    @InjectRepository(PipelineRunEntity)
    private readonly pipelineRunRepo: Repository<PipelineRunEntity>,
    private readonly executor: AgentExecutorService,
  ) {}

  async runMulti(task: string): Promise<PipelineRunEntity> {
    const pipelineRun = await this.pipelineRunRepo.save(
      this.pipelineRunRepo.create({ task, status: PipelineRunStatus.RUNNING }),
    );

    const [researchRunId, codeRunId, reviewRunId] = await Promise.all([
      this.createRun(task, pipelineRun.id, 'research'),
      this.createRun(task, pipelineRun.id, 'code'),
      this.createRun(task, pipelineRun.id, 'review'),
    ]);

    this.logger.log(`[Pipeline ${pipelineRun.id}] Starting 3 agents in parallel`);

    const [research, code, review] = await Promise.all([
      this.executeAgent(RESEARCH_AGENT, task, researchRunId),
      this.executeAgent(CODE_AGENT, task, codeRunId),
      this.executeAgent(REVIEW_AGENT, task, reviewRunId),
    ]);

    this.logger.log(`[Pipeline ${pipelineRun.id}] All agents done — synthesising`);

    let final: string;
    let finalStatus = PipelineRunStatus.COMPLETED;
    try {
      final = await this.synthesize(task, research, code, review);
    } catch (err) {
      final = `Synthesis failed: ${err instanceof Error ? err.message : String(err)}`;
      finalStatus = PipelineRunStatus.FAILED;
    }

    await this.pipelineRunRepo.update(pipelineRun.id, {
      status: finalStatus,
      agentResults: { research, code, review, final },
    });

    return this.pipelineRunRepo.findOneOrFail({
      where: { id: pipelineRun.id },
      relations: ['agentRuns'],
    });
  }

  private async createRun(task: string, pipelineRunId: string, agentRole: string): Promise<string> {
    const run = await this.runRepo.save(
      this.runRepo.create({
        task,
        pipelineRunId,
        agentRole,
        agentId: null,
        status: AgentRunStatus.PENDING,
      }),
    );
    return run.id;
  }

  private async executeAgent(spec: AgentSpec, task: string, runId: string): Promise<string> {
    await this.runRepo.update(runId, { status: AgentRunStatus.RUNNING });
    try {
      const result = await this.executor.execute(spec, task);
      await this.runRepo.update(runId, { status: AgentRunStatus.COMPLETED, result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[${spec.name}] failed: ${message}`);
      await this.runRepo.update(runId, { status: AgentRunStatus.FAILED, result: message });
      return `[FAILED] ${message}`;
    }
  }

  private async synthesize(
    task: string,
    research: string,
    code: string,
    review: string,
  ): Promise<string> {
    const response = await this.groq.chat.completions.create({
      model: DEFAULT_AGENT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an Orchestrator. Synthesise the findings from three specialist agents ' +
            '(ResearchAgent, CodeAgent, ReviewAgent) into one coherent, actionable implementation plan. ' +
            'Incorporate the review feedback into the code proposal. Be concise and prioritise ' +
            'concrete, ready-to-implement guidance.',
        },
        {
          role: 'user',
          content:
            `Task: ${task}\n\n` +
            `## ResearchAgent\n${research}\n\n` +
            `## CodeAgent\n${code}\n\n` +
            `## ReviewAgent\n${review}\n\n` +
            'Produce the final implementation plan.',
        },
      ],
    });

    return response.choices[0]?.message.content ?? '';
  }
}
