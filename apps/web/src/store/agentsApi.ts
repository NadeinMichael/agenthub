import { baseApi } from './baseApi';

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  config: Record<string, unknown> | null;
  schedule: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface CreateAgentRequest {
  name: string;
  description?: string;
  status?: 'active' | 'inactive' | 'error';
  config?: Record<string, unknown>;
  schedule?: string | null;
}

export type UpdateAgentRequest = Partial<CreateAgentRequest>;

export const agentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgents: build.query<Agent[], void>({
      query: () => '/agents',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Agent' as const, id })), { type: 'Agent', id: 'LIST' }]
          : [{ type: 'Agent', id: 'LIST' }],
    }),
    getAgent: build.query<Agent, string>({
      query: (id) => `/agents/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Agent', id }],
    }),
    createAgent: build.mutation<Agent, CreateAgentRequest>({
      query: (body) => ({ url: '/agents', method: 'POST', body }),
      invalidatesTags: [{ type: 'Agent', id: 'LIST' }],
    }),
    updateAgent: build.mutation<Agent, { id: string; body: UpdateAgentRequest }>({
      query: ({ id, body }) => ({ url: `/agents/${id}`, method: 'PATCH', body }),
      invalidatesTags: (_result, _err, { id }) => [{ type: 'Agent', id }, { type: 'Agent', id: 'LIST' }],
    }),
    deleteAgent: build.mutation<void, string>({
      query: (id) => ({ url: `/agents/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _err, id) => [{ type: 'Agent', id }, { type: 'Agent', id: 'LIST' }],
    }),
    getAgentRuns: build.query<AgentRun[], string>({
      query: (id) => `/agents/${id}/runs`,
      providesTags: (_result, _err, id) => [{ type: 'AgentRun', id }],
    }),
    getRecentRuns: build.query<AgentRun[], void>({
      query: () => '/agents/runs',
      providesTags: [{ type: 'AgentRun', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetAgentsQuery,
  useGetAgentQuery,
  useCreateAgentMutation,
  useUpdateAgentMutation,
  useDeleteAgentMutation,
  useGetAgentRunsQuery,
  useGetRecentRunsQuery,
} = agentsApi;
