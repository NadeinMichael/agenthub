export type AgentStatus = 'active' | 'inactive' | 'error';

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  config: Record<string, unknown> | null;
  schedule: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  agentId: string | null;
  agent: Agent | null;
  agentRole: string | null;
  task: string;
  result: string | null;
  status: AgentRunStatus;
  createdAt: string;
}

export interface CreateAgentDto {
  name: string;
  description?: string;
  status?: AgentStatus;
  config?: Record<string, unknown>;
  schedule?: string | null;
}

export type UpdateAgentDto = Partial<CreateAgentDto>;
