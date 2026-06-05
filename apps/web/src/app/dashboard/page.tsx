'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import type { Agent, AgentRun } from '../../store/agentsApi';
import { useGetAgentsQuery, useGetRecentRunsQuery } from '../../store/agentsApi';

const POLL_INTERVAL = 10_000;

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
  inactive: 'bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600',
  error: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
  pending: 'bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600',
  running: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? STATUS_BADGE['inactive']}`}
    >
      {status === 'running' && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
      )}
      {status}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-zinc-100 truncate">{agent.name}</span>
        <StatusBadge status={agent.status} />
      </div>
      {agent.description && (
        <p className="text-xs text-zinc-500 line-clamp-2">{agent.description}</p>
      )}
      {agent.schedule ? (
        <p className="text-xs font-mono text-zinc-400">
          <span className="text-zinc-600">cron </span>
          {agent.schedule}
        </p>
      ) : (
        <p className="text-xs text-zinc-600">no schedule</p>
      )}
    </div>
  );
}

function RunsTable({ runs }: { runs: AgentRun[] }) {
  if (runs.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-600">No runs yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-xs font-medium text-zinc-500">
            <th className="pb-3 pr-4 font-medium">Agent</th>
            <th className="pb-3 pr-4 font-medium">Task</th>
            <th className="pb-3 pr-4 font-medium">Status</th>
            <th className="pb-3 pr-4 font-medium">Time</th>
            <th className="pb-3 font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {runs.map((run) => (
            <tr key={run.id} className="group">
              <td className="py-3 pr-4 text-zinc-300 whitespace-nowrap">
                {run.agent?.name ?? <span className="text-zinc-600">—</span>}
              </td>
              <td className="py-3 pr-4 text-zinc-400 max-w-[200px] truncate" title={run.task}>
                {run.task}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap">
                <StatusBadge status={run.status} />
              </td>
              <td className="py-3 pr-4 text-zinc-500 whitespace-nowrap text-xs">
                {fmt(run.createdAt)}
              </td>
              <td className="py-3 text-zinc-500 max-w-[280px] truncate text-xs font-mono">
                {run.result ? run.result.slice(0, 100) : <span className="text-zinc-700">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TokenGate({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    setToken(localStorage.getItem('token'));
  }, []);

  if (token) return <>{children}</>;

  function save() {
    const t = input.trim();
    if (!t) return;
    localStorage.setItem('token', t);
    setToken(t);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">Auth token required</h2>
        <p className="text-sm text-zinc-500">
          Paste a JWT from{' '}
          <code className="text-zinc-400">POST /api/v1/auth/login</code> to continue.
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="eyJhbGci..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
        <button
          onClick={save}
          className="w-full rounded-lg bg-zinc-700 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-600 transition-colors"
        >
          Save &amp; continue
        </button>
      </div>
    </div>
  );
}

function DashboardContent() {
  const {
    data: agents = [],
    isLoading: agentsLoading,
    error: agentsError,
  } = useGetAgentsQuery(undefined, { pollingInterval: POLL_INTERVAL });

  const {
    data: runs = [],
    isLoading: runsLoading,
    error: runsError,
    fulfilledTimeStamp,
  } = useGetRecentRunsQuery(undefined, { pollingInterval: POLL_INTERVAL });

  const lastUpdated = fulfilledTimeStamp ? new Date(fulfilledTimeStamp).toLocaleTimeString() : null;

  const activeCount = agents.filter((a) => a.status === 'active').length;
  const completedCount = runs.filter((r) => r.status === 'completed').length;
  const successRate =
    runs.length > 0 ? Math.round((completedCount / runs.length) * 100) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Home
          </Link>
          <span className="text-zinc-700">/</span>
          <h1 className="text-lg font-semibold text-zinc-100">Dashboard</h1>
        </div>
        {lastUpdated && (
          <span className="text-xs text-zinc-600">
            last updated {lastUpdated} · auto-refresh 10s
          </span>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Agents', value: agentsLoading ? '…' : agents.length },
            { label: 'Active', value: agentsLoading ? '…' : activeCount },
            { label: 'Success Rate (last 20)', value: runsLoading ? '…' : successRate != null ? `${successRate}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs font-medium text-zinc-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-zinc-100">{value}</p>
            </div>
          ))}
        </div>

        {/* Agents */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Agents
          </h2>
          {agentsError ? (
            <p className="text-sm text-red-400">Failed to load agents.</p>
          ) : agentsLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl border border-zinc-800 bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-zinc-600">No agents found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </section>

        {/* Runs */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-500">
            Recent Runs{' '}
            <span className="normal-case font-normal text-zinc-600">(last 20)</span>
          </h2>
          {runsError ? (
            <p className="text-sm text-red-400">Failed to load runs.</p>
          ) : runsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-4">
              <RunsTable runs={runs} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <TokenGate>
      <DashboardContent />
    </TokenGate>
  );
}
