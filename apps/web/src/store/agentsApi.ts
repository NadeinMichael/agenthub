import { baseApi } from './baseApi';

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  schedule: string | null;
  createdAt: string;
}

export interface AgentRun {
  id: string;
  agentId: string | null;
  agent: Agent | null;
  task: string;
  result: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
}

export const agentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgents: build.query<Agent[], void>({
      query: () => '/agents',
    }),
    getAgentRuns: build.query<AgentRun[], string>({
      query: (id) => `/agents/${id}/runs`,
    }),
    getRecentRuns: build.query<AgentRun[], void>({
      query: () => '/agents/runs',
    }),
  }),
});

export const { useGetAgentsQuery, useGetAgentRunsQuery, useGetRecentRunsQuery } = agentsApi;
