import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { DataSource } from 'typeorm';

import type { AgentEntity } from '../agents/agent.entity';

const PROJECT_ROOT = process.env['AGENT_PROJECT_ROOT'] ?? process.cwd();
const SANDBOX_DIR = process.env['AGENT_SANDBOX_DIR'] ?? '/tmp/agenthub-sandbox';
const MAX_ITERATIONS = 10;
// llama-3.3-70b-versatile sometimes emits Hermes-format tool calls that Groq rejects.
// The dedicated tool-use model is reliable; it is still overridable via agent.config.model.
const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const TOOLS: Groq.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the contents of a file by path relative to the project root. ' +
        'Call this when you need to inspect source code or configuration files.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path from the project root, e.g. "apps/api/src/app.module.ts"',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description:
        'List files and sub-directories inside a directory relative to the project root. ' +
        'Use this to explore the project structure before reading specific files.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'Relative path from the project root. Pass "." to list the root itself.',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Write text content to a file in the sandbox directory. ' +
        'Call this to persist results or create output files.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path within the sandbox directory',
          },
          content: {
            type: 'string',
            description: 'Text content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_database',
      description:
        'Execute a read-only SQL SELECT query on the agenthub_db database and return results as JSON. ' +
        'Only SELECT statements are permitted.',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'SQL SELECT query to execute against agenthub_db',
          },
        },
        required: ['sql'],
      },
    },
  },
];

@Injectable()
export class AgentExecutorService {
  private readonly logger = new Logger(AgentExecutorService.name);
  private readonly groq = new Groq({ apiKey: process.env['GROQ_API_KEY'] });

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(agent: AgentEntity, task: string): Promise<string> {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });

    const configModel = (agent.config?.['model'] as string | undefined) ?? '';
    const model =
      configModel && !configModel.startsWith('claude-')
        ? configModel
        : DEFAULT_MODEL;

    const systemParts = [
      `You are ${agent.name}.`,
      agent.description ?? '',
      (agent.config?.['systemPrompt'] as string | undefined) ?? '',
      'You have access to the following tools and MUST use them to complete tasks: ' +
        'read_file (read a project file by relative path), ' +
        'list_directory (list files in a project directory), ' +
        'write_file (write output to sandbox), ' +
        'query_database (run a SELECT query on the database). ' +
        'Always call the appropriate tool instead of saying you cannot access something.',
    ].filter(Boolean);
    const systemText = systemParts.join('\n').trim();

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemText },
      { role: 'user', content: task },
    ];

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      let toolCalls: Groq.Chat.ChatCompletionMessageToolCall[];

      try {
        const response = await this.groq.chat.completions.create({
          model,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
        });

        const choice = response.choices[0];
        if (!choice) return '';

        const { message, finish_reason } = choice;

        if (finish_reason === 'stop' || !message.tool_calls?.length) {
          return message.content ?? '';
        }

        toolCalls = message.tool_calls;
        messages.push({
          role: 'assistant',
          content: message.content ?? null,
          tool_calls: toolCalls,
        });
      } catch (err) {
        // Some models (e.g. llama-3.3-70b-versatile) emit Hermes-format tool calls
        // instead of structured tool_calls; Groq rejects these with tool_use_failed.
        // Parse the failed_generation and recover so the run can continue.
        const recovered = this.tryRecoverHermesToolCalls(err);
        if (!recovered) throw err;
        toolCalls = recovered;
        this.logger.warn(
          `[${agent.name}] tool_use_failed on iteration ${iteration} — recovered ${toolCalls.length} call(s) from hermes format`,
        );
        messages.push({ role: 'assistant', content: null, tool_calls: toolCalls });
      }

      for (const toolCall of toolCalls) {
        const fnName = toolCall.function.name;
        let input: Record<string, string>;

        try {
          input = JSON.parse(toolCall.function.arguments) as Record<string, string>;
        } catch {
          input = {};
        }

        let resultText: string;
        try {
          resultText = await this.executeTool(fnName, input);
          this.logger.debug(`[${agent.name}] ${fnName} → ${resultText.slice(0, 120)}`);
        } catch (toolErr) {
          resultText = `Error: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`;
          this.logger.warn(`[${agent.name}] ${fnName} failed: ${resultText}`);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: resultText,
        });
      }
    }

    return 'Reached maximum iteration limit without completing the task.';
  }

  private async executeTool(
    name: string,
    input: Record<string, string>,
  ): Promise<string> {
    switch (name) {
      case 'read_file': {
        const resolved = this.projectPath(input['path'] ?? '');
        return fs.readFile(resolved, 'utf-8');
      }

      case 'list_directory': {
        const resolved = this.projectPath(input['path'] ?? '.');
        const entries = await fs.readdir(resolved, { withFileTypes: true });
        const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
        return lines.join('\n');
      }

      case 'write_file': {
        const resolved = this.sandboxPath(input['path'] ?? '');
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, input['content'] ?? '', 'utf-8');
        return `Wrote ${input['content']?.length ?? 0} chars to ${input['path']}`;
      }

      case 'query_database': {
        const sql = (input['sql'] ?? '').trim();
        if (!/^SELECT\b/i.test(sql)) {
          throw new Error('Only SELECT statements are permitted');
        }
        const rows = (await this.dataSource.query(sql)) as unknown[];
        return JSON.stringify(rows, null, 2);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Groq returns 400 tool_use_failed when a model emits tool calls in the
   * Hermes text format (<function=name({"k":"v"})</function>) instead of
   * structured tool_calls. Parse the raw failed_generation so the loop
   * can still execute the tools and continue.
   */
  private tryRecoverHermesToolCalls(
    err: unknown,
  ): Groq.Chat.ChatCompletionMessageToolCall[] | null {
    if (
      typeof err !== 'object' ||
      err === null ||
      !('status' in err) ||
      (err as { status: unknown }).status !== 400 ||
      !('error' in err)
    )
      return null;

    const body = (err as { error: unknown }).error as Record<string, unknown> | null;
    if (body?.['code'] !== 'tool_use_failed') return null;

    const raw = body['failed_generation'] as string | undefined;
    if (!raw) return null;

    const calls: Groq.Chat.ChatCompletionMessageToolCall[] = [];
    const openRe = /<function=(\w+)\(/g;

    for (const startMatch of raw.matchAll(openRe)) {
      const fnName = startMatch[1] ?? '';
      const jsonStart = (startMatch.index ?? 0) + startMatch[0].length;

      // Walk forward tracking brace depth so nested JSON and SQL parens don't break parsing
      let depth = 0;
      let inString = false;
      let escaped = false;
      let jsonEnd = -1;

      for (let i = jsonStart; i < raw.length; i++) {
        const ch = raw[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') { depth++; continue; }
        if (ch === '}') {
          depth--;
          if (depth === 0) { jsonEnd = i + 1; break; }
        }
      }

      if (jsonEnd === -1) continue;

      calls.push({
        id: `hermes_${Date.now()}_${calls.length}`,
        type: 'function',
        function: { name: fnName, arguments: raw.slice(jsonStart, jsonEnd) },
      });
    }

    return calls.length > 0 ? calls : null;
  }

  private projectPath(inputPath: string): string {
    const resolved = path.resolve(PROJECT_ROOT, inputPath);
    const rootWithSep = PROJECT_ROOT.endsWith(path.sep)
      ? PROJECT_ROOT
      : PROJECT_ROOT + path.sep;
    if (resolved !== PROJECT_ROOT && !resolved.startsWith(rootWithSep)) {
      throw new Error(`Path traversal attempt: ${inputPath}`);
    }
    return resolved;
  }

  private sandboxPath(inputPath: string): string {
    const resolved = path.resolve(SANDBOX_DIR, inputPath);
    const sandboxWithSep = SANDBOX_DIR.endsWith(path.sep)
      ? SANDBOX_DIR
      : SANDBOX_DIR + path.sep;
    if (resolved !== SANDBOX_DIR && !resolved.startsWith(sandboxWithSep)) {
      throw new Error(`Path traversal attempt: ${inputPath}`);
    }
    return resolved;
  }
}
