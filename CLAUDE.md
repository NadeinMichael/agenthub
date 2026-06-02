# AgentHub — CLAUDE.md

## Project Overview

AgentHub is an AI agent management platform — a monorepo with a Next.js 15 frontend and NestJS 10 backend.

## Monorepo Structure

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
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Tech Stack

| Layer      | Technology                             |
|------------|----------------------------------------|
| Frontend   | Next.js 15, React 19, Tailwind CSS 3   |
| Backend    | NestJS 10, Fastify, TypeORM            |
| Database   | PostgreSQL 16                          |
| Cache      | Redis 7                                |
| Monorepo   | pnpm workspaces + Turborepo            |
| Language   | TypeScript 5 (strict mode)             |
| Linting    | ESLint 9 flat config                   |
| Formatting | Prettier 3                             |

## Commands

```bash
# Install all dependencies
pnpm install

# Start all services (DB + Redis)
pnpm docker:up

# Develop (all apps in parallel via Turborepo)
pnpm dev

# Build all
pnpm build

# Lint all
pnpm lint

# Type-check all
pnpm type-check

# Format all files
pnpm format
```

## Environment Setup

```bash
cp .env.example .env
# Fill in secrets (JWT_SECRET, ANTHROPIC_API_KEY)
pnpm docker:up   # start postgres + redis
pnpm install
pnpm dev
```

## Key Conventions

- **TypeScript strict mode** everywhere including `noUncheckedIndexedAccess`
- **NestJS**: Fastify adapter, class-validator DTOs, Swagger auto-docs at `/api/docs`
- **Next.js**: App Router only, Server Components by default, `use client` only when needed
- **Imports**: always use `type` imports for types (`import type { Foo } from '...'`)
- **API prefix**: all NestJS routes under `/api/v1/`
- **Shared types**: add to `packages/shared/src/types/`, export from `packages/shared/src/index.ts`
- **No `any`**: `@typescript-eslint/no-explicit-any` is an error

## Database

- ORM: TypeORM with `autoLoadEntities: true`
- Entities live in `apps/api/src/modules/<feature>/<feature>.entity.ts`
- Migrations go in `apps/api/src/migrations/`
- `synchronize: true` only in development

## Testing

- API: Jest + `@nestjs/testing` — files named `*.spec.ts`
- Run: `pnpm test` (all) or `cd apps/api && pnpm test`
