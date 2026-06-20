# Otomat Codebase Map

This is the target map for the Otomat monorepo. It is intentionally a map, not
permission to scaffold every package in OTO-5.

Packages stay flat under `packages/*` at the start. The frontend/backend/shared
grouping is conceptual and enforced by import-boundary lint rules. Nested
`packages/frontend/*` or `packages/backend/*` can be reconsidered later if the
package count becomes large enough to justify it.

## Target Tree

```text
apps/
  web/                 # OTO-5 creates shell; OTO-9 builds React cockpit shell
  local-daemon/        # OTO-5 creates shell; OTO-9 adds HTTP+SSE; OTO-10 supervises
  desktop/  (later)    # Post-V1: Tauri shell launching/observing local-daemon
  mobile/   (later)    # Post-V1: companion app, no local agent execution
  cli/      (later)    # Post-V1 or hardening: command-line controls

packages/
  domain/              # OTO-5: pure TS domain, state machines, event envelope, zod contracts
  db/                  # OTO-5: better-sqlite3 + Drizzle schema/migrations/repositories
  tooling/             # OTO-5: shared tsconfig, lint, vitest/build presets

  runtime/   (later)   # OTO-6: runtime adapter contract + deterministic fake adapter
  events/    (later)   # OTO-7: event ledger, per-run seq allocation, stream-to-file tailer
  git/       (later)   # OTO-8: worktree/branch lifecycle and canonical git diff
  api/       (later)   # OTO-9: local daemon HTTP routes and SSE handlers
  ui/        (later)   # OTO-9: shadcn primitives and Otomat design system
  client/    (later)   # OTO-9: typed daemon API client and SSE client
  domains/   (later)   # OTO-9: grouped frontend domains (issues, runs, review, settings)
  supervisor/(later)   # OTO-10: process lifecycle, pid/pgid tracking, reconciliation
  integrations/(later) # OTO-11 or post-V1: Linear/GitHub daemon-side clients/cache
  review/    (later)   # OTO-11: pin-to-SHA comments and fix-context builder
```

## Ticket Ownership

| Path                    | Owner                           | Notes                                                                                      |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`              | OTO-5, expanded by OTO-9        | OTO-5 creates a minimal Vite/React shell only. No real issue workspace yet.                |
| `apps/local-daemon`     | OTO-5, expanded by OTO-9/OTO-10 | OTO-5 creates a minimal local process shell only. No API, runtime host, or supervisor yet. |
| `apps/desktop`          | Post-V1                         | Tauri shell after the web + local daemon loop works.                                       |
| `apps/mobile`           | Post-V1                         | Companion app only; it does not spawn local agents.                                        |
| `apps/cli`              | Post-V1 or hardening            | Optional operator CLI.                                                                     |
| `packages/domain`       | OTO-5                           | Pure TypeScript. Owns canonical types, state machines, event envelope, and zod contracts.  |
| `packages/db`           | OTO-5                           | Owns SQLite driver isolation, Drizzle schema, migrations, and repository helpers.          |
| `packages/tooling`      | OTO-5                           | Shared TypeScript, lint/boundary, and test configuration.                                  |
| `packages/runtime`      | OTO-6                           | Thin push-sink adapter contract and fake adapter.                                          |
| `packages/events`       | OTO-7                           | Append-only event store, non-lossy stream-to-file ingestion, event projections.            |
| `packages/git`          | OTO-8                           | Worktree/branch ownership, canonical diff, cleanup primitives.                             |
| `packages/api`          | OTO-9                           | Local daemon routes and SSE surface.                                                       |
| `packages/ui`           | OTO-9                           | Shared UI primitives/design system, based on shadcn/Tailwind/lucide.                       |
| `packages/client`       | OTO-9                           | Typed API/SSE client for the local daemon.                                                 |
| `packages/domains`      | OTO-9                           | Frontend application domains grouped by product area.                                      |
| `packages/supervisor`   | OTO-10                          | Process supervision, pid reconciliation, resume-on-action behavior.                        |
| `packages/integrations` | OTO-11 or post-V1               | Linear/GitHub clients. Start only when the local loop needs real integration.              |
| `packages/review`       | OTO-11                          | Review pinning and fix-context builder for the E2E slice.                                  |

## OTO-5 Scope

OTO-5 creates real content for only:

- `apps/web`
- `apps/local-daemon`
- `packages/domain`
- `packages/db`
- `packages/tooling`

OTO-5 must not create placeholder packages for `runtime`, `events`, `git`,
`api`, `ui`, `client`, `domains`, `supervisor`, `integrations`, or `review`.
Those packages are created by their owning tickets when they have real code.

## Frontend Stack Direction

The preferred frontend stack is:

- React
- Vite
- TanStack Router
- TanStack Query
- TanStack Form
- Tailwind
- shadcn
- lucide-react
- sonner
- zod
- zustand, only when a local UI store is actually needed
- `@git-diff-view/react` for diff surfaces
- xterm for terminal/session surfaces

OTO-5 does not build real frontend behavior. OTO-9 introduces the web cockpit
shell and should decide which frontend packages need to be created at that time.

## Offline-First Direction

For V1, the local daemon is the offline cache:

- it mirrors external state into SQLite;
- it serves the last known state even without network;
- it streams local updates to the web app over SSE.

The frontend uses TanStack Query plus SSE later. Do not create an IndexedDB
replica or `frontend/store` package in OTO-5.
