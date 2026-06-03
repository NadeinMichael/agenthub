import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { DataSource } from 'typeorm';

// Read lazily so NestJS ConfigModule has time to populate process.env from .env files
// before the first request arrives. Top-level consts are evaluated at import time.
const getProjectRoot = () => process.env['AGENT_PROJECT_ROOT'] ?? process.cwd();
const getSandboxDir  = () => process.env['AGENT_SANDBOX_DIR']  ?? '/tmp/agenthub-sandbox';
const MAX_ITERATIONS = 10;
// llama-3.3-70b-versatile sometimes emits Hermes-format tool calls that Groq rejects.
// The dedicated tool-use model is reliable; it is still overridable via agent.config.model.
export const DEFAULT_AGENT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export interface AgentSpec {
  name: string;
  description: string | null;
  config: Record<string, unknown> | null;
}

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

  async execute(agent: AgentSpec, task: string): Promise<string> {
    const sandboxDir = getSandboxDir();
    await fs.mkdir(sandboxDir, { recursive: true });

    const configModel = (agent.config?.['model'] as string | undefined) ?? '';
    const model =
      configModel && !configModel.startsWith('claude-')
        ? configModel
        : DEFAULT_AGENT_MODEL;

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
        // Some models emit tool calls in non-standard text formats (Hermes, JSON array).
        // Groq rejects these with tool_use_failed. Try to recover structured calls.
        const recovered = this.tryRecoverToolCalls(err);
        if (recovered.toolCalls) {
          toolCalls = recovered.toolCalls;
          this.logger.warn(
            `[${agent.name}] tool_use_failed on iteration ${iteration} — recovered ${toolCalls.length} call(s) (${recovered.format})`,
          );
          messages.push({ role: 'assistant', content: null, tool_calls: toolCalls });
        } else if (recovered.plainText !== undefined) {
          // Model answered in plain text without tool calls — treat as final answer.
          this.logger.warn(
            `[${agent.name}] tool_use_failed on iteration ${iteration} — using failed_generation as final answer`,
          );
          return recovered.plainText;
        } else {
          throw err;
        }
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
   * Groq returns 400 tool_use_failed when a model emits tool calls in a
   * non-standard text format. We handle two formats:
   *   1. Hermes:     <function=name({"k":"v"})</function>
   *   2. JSON array: [{"name":"fn","parameters":{...}}]
   *
   * If neither format is found but failed_generation contains a prose answer,
   * we surface it as `plainText` so the caller can return it directly.
   */
  private tryRecoverToolCalls(err: unknown): {
    toolCalls?: Groq.Chat.ChatCompletionMessageToolCall[];
    plainText?: string;
    format?: string;
  } {
    if (typeof err !== 'object' || err === null) return {};

    const raw = this.extractFailedGeneration(err);
    if (!raw) return {};

    // 1. Hermes format: <function=name({...})</function>
    const hermesCalls = this.parseHermesFormat(raw);
    if (hermesCalls.length > 0) return { toolCalls: hermesCalls, format: 'hermes' };

    // 2. JSON array: [{"name":"fn","parameters":{...}}]
    const jsonArrayCalls = this.parseJsonArrayFormat(raw);
    if (jsonArrayCalls.length > 0) return { toolCalls: jsonArrayCalls, format: 'json-array' };

    // 3. Plain prose answer with no tool call markers — return as final text
    return { plainText: raw };
  }

  /**
   * Extract `failed_generation` from a Groq tool_use_failed error.
   * The SDK may wrap the body as err.error = { error: { code, failed_generation } }
   * or flat as err.error = { code, failed_generation }.
   * As a last resort, parse it out of the stringified err.message.
   */
  private extractFailedGeneration(err: object): string | undefined {
    const errMap = err as Record<string, unknown>;
    const tryBody = (obj: unknown): string | undefined => {
      if (typeof obj !== 'object' || obj === null) return undefined;
      const b = obj as Record<string, unknown>;
      if (b['code'] === 'tool_use_failed' && typeof b['failed_generation'] === 'string') {
        return b['failed_generation'];
      }
      // One level deeper (body wrapper: { error: { code, failed_generation } })
      if (typeof b['error'] === 'object') return tryBody(b['error']);
      return undefined;
    };

    if ('error' in errMap) {
      const found = tryBody(errMap['error']);
      if (found) return found;
    }

    // Fallback: scan the stringified message for failed_generation
    const msg = typeof errMap['message'] === 'string' ? (errMap['message'] as string) : '';
    if (!msg.includes('tool_use_failed')) return undefined;
    const idx = msg.indexOf('"failed_generation":"');
    if (idx === -1) return undefined;
    const valStart = idx + '"failed_generation":"'.length;
    // Walk forward to find the closing unescaped quote
    let result = '';
    let i = valStart;
    while (i < msg.length) {
      const ch = msg[i];
      if (ch === '\\' && i + 1 < msg.length) { result += msg[i + 1]; i += 2; continue; }
      if (ch === '"') break;
      result += ch;
      i++;
    }
    return result || undefined;
  }

  private parseHermesFormat(raw: string): Groq.Chat.ChatCompletionMessageToolCall[] {
    const calls: Groq.Chat.ChatCompletionMessageToolCall[] = [];
    const openRe = /<function=(\w+)\(/g;

    for (const startMatch of raw.matchAll(openRe)) {
      const fnName = startMatch[1] ?? '';
      const jsonStart = (startMatch.index ?? 0) + startMatch[0].length;

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
    return calls;
  }

  private parseJsonArrayFormat(raw: string): Groq.Chat.ChatCompletionMessageToolCall[] {
    const arrayStart = raw.indexOf('[');
    const arrayEnd = raw.lastIndexOf(']');
    if (arrayStart === -1 || arrayEnd <= arrayStart) return [];

    type JsonToolItem = { name?: unknown; parameters?: unknown; arguments?: unknown };
    let arr: JsonToolItem[];
    try {
      arr = JSON.parse(raw.slice(arrayStart, arrayEnd + 1)) as JsonToolItem[];
    } catch {
      return [];
    }
    if (!Array.isArray(arr)) return [];

    const calls: Groq.Chat.ChatCompletionMessageToolCall[] = [];
    for (const item of arr) {
      if (typeof item.name !== 'string') continue;
      const params = (item.parameters ?? item.arguments ?? {}) as Record<string, unknown>;
      calls.push({
        id: `json_array_${Date.now()}_${calls.length}`,
        type: 'function',
        function: { name: item.name, arguments: JSON.stringify(params) },
      });
    }
    return calls;
  }

  private projectPath(inputPath: string): string {
    const root = getProjectRoot();
    const resolved = path.resolve(root, inputPath);
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved !== root && !resolved.startsWith(rootWithSep)) {
      throw new Error(`Path traversal attempt: ${inputPath}`);
    }
    return resolved;
  }

  private sandboxPath(inputPath: string): string {
    const sandbox = getSandboxDir();
    const resolved = path.resolve(sandbox, inputPath);
    const sandboxWithSep = sandbox.endsWith(path.sep) ? sandbox : sandbox + path.sep;
    if (resolved !== sandbox && !resolved.startsWith(sandboxWithSep)) {
      throw new Error(`Path traversal attempt: ${inputPath}`);
    }
    return resolved;
  }
}
