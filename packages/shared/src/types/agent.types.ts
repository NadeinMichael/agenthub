export type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export type AgentProvider = 'anthropic' | 'openai' | 'google';

export interface Agent {
  id: string;
  name: string;
  description: string;
  provider: AgentProvider;
  model: string;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentDto {
  name: string;
  description: string;
  provider: AgentProvider;
  model: string;
}

export interface UpdateAgentDto extends Partial<CreateAgentDto> {}
