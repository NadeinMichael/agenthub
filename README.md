# AgentHub

AI agent management platform. Monorepo with a Next.js 15 frontend and NestJS 10 backend.

## Tech Stack

| Layer      | Technology                                          |
|------------|-----------------------------------------------------|
| Frontend   | Next.js 15, React 19, Tailwind CSS 3, Zustand, TanStack Query |
| Backend    | NestJS 10, Fastify, TypeORM, Passport JWT           |
| Database   | PostgreSQL 16                                       |
| Cache      | Redis 7                                             |
| Monorepo   | pnpm workspaces + Turborepo                         |
| Language   | TypeScript 5 (strict mode)                          |

## Project Structure

```
agenthub/
├── apps/
│   ├── web/              # Next.js 15 App Router (port 3000)
│   └── api/              # NestJS 10 + Fastify (port 3001)
├── packages/
│   ├── shared/           # Shared TypeScript types & utilities
│   └── ui/               # Shared React components (future)
├── docker/
│   └── init.sql          # Postgres initialization
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required secrets:

| Variable            | Description                          |
|---------------------|--------------------------------------|
| `JWT_SECRET`        | Long random string for JWT signing   |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (`sk-ant-...`)|

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
pnpm docker:up
```

### 4. Run in development mode

```bash
pnpm dev
```

| Service  | URL                          |
|----------|------------------------------|
| Web      | http://localhost:3000        |
| API      | http://localhost:3001        |
| Swagger  | http://localhost:3001/api/docs |
| pgAdmin  | http://localhost:5050 (profile `tools`) |

## Available Commands

```bash
pnpm dev          # Start all apps in parallel (Turborepo)
pnpm build        # Build all apps
pnpm lint         # Lint all
pnpm type-check   # TypeScript type-check all
pnpm test         # Run all tests
pnpm format       # Format all files with Prettier
pnpm docker:up    # Start Postgres + Redis
pnpm docker:down  # Stop all Docker services
```

## API

All routes are prefixed with `/api/v1/`. Interactive Swagger docs are available at `/api/docs` when the API is running.

## Architecture Notes

- **Backend**: NestJS with Fastify adapter, class-validator DTOs, TypeORM with `autoLoadEntities`
- **Frontend**: App Router only, Server Components by default, `use client` only when needed
- **Auth**: JWT via Passport (access + refresh token pattern)
- **Shared types**: `packages/shared` — imported in both apps as `@agenthub/shared`
