# Otomat Codebase Map

This is the map of the Otomat monorepo as it stands, plus where later tickets add
code. It is a map, not permission to scaffold empty packages.

`apps/*` are **runnable targets** (a UI app or a local process), not only UI apps.
A directory under `packages/*` exists only when it earns it (see "When something is
a package" below); daemon-only backend code lives inside `apps/local-daemon`.

## Current Tree

```text
apps/
  web/                 # React + Vite cockpit (OTO-9, refactored in OTO-15)
  local-daemon/        # Node local process — hosts the backend as internal modules
    src/
      api/             # HTTP routes + SSE handlers          (OTO-9)
      events/          # event ledger + stream-to-file tailer (OTO-7)
      git/             # worktree/branch lifecycle + diff      (OTO-8)
      runtime/         # runtime adapter contract + fake adapter (OTO-6)
      index.ts server.ts launcher.ts bootstrap.ts   # composition root / entrypoint
    tests/             # api/ events/ git/ runtime/ launcher.test.ts + support/

packages/
  domain/              # pure TS domain, state machines, event envelope, zod contracts (OTO-5)
  db/                  # better-sqlite3 + Drizzle schema/migrations/repositories (OTO-5)
  ui/                  # Base UI primitives + Otomat design system (OTO-9)
  client/              # typed daemon API/SSE client for the frontend (OTO-9)
  tooling/             # shared tsconfig, lint, vitest/build/boundary presets (OTO-5)

apps/ (later)
  desktop/             # Post-V1: Tauri shell launching/observing local-daemon
  mobile/              # Post-V1: companion app, no local agent execution
  cli/                 # Post-V1 or hardening: command-line controls
```

## When something is a package

A directory is a **package** only when it has a real reason to be one:

- multiple real consumers;
- an important boundary to protect;
- a heavy/dangerous dependency to isolate;
- a stable interface between two worlds;
- reuse planned across more than one app.

Otherwise it is an internal folder of an app/process. Do not create a new package
without an explicit justification recorded in its owning ticket.

Why each current package qualifies:

| Package           | Reason it is a package                                                            |
| ----------------- | --------------------------------------------------------------------------------- |
| `domain`          | Shared by every app and module; the single source of canonical types/contracts.   |
| `db`              | Isolates the native `better-sqlite3` driver + Drizzle schema; used by all backend modules; an enforced boundary. |
| `ui`              | Frontend design system reused by `web` and future `desktop`/`mobile`.             |
| `client`          | Typed daemon API/SSE client reused by `web` and future frontend apps.             |
| `tooling`         | Shared build/lint/test/boundary config.                                           |

Why `api`, `events`, `git`, `runtime` are **not** packages: each was consumed only
by the local daemon (and each other) — no frontend or cross-app consumer — so they
are internal daemon modules, consumed through `#api`/`#events`/`#git`/`#runtime`
subpath imports. The future `supervisor` (OTO-10) lands the same way under
`apps/local-daemon/src/supervisor`.

## Ticket Ownership

| Path                              | Owner                    | Notes                                                                 |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `apps/web`                        | OTO-5, OTO-9, OTO-15     | Vite/React cockpit; file-based routing + domain-split components.     |
| `apps/local-daemon`               | OTO-5, OTO-9/10, OTO-13  | Local process host; backend modules folded in by OTO-13.              |
| `apps/local-daemon/src/runtime`   | OTO-6                    | Push-sink adapter contract and fake adapter.                          |
| `apps/local-daemon/src/events`    | OTO-7                    | Append-only event store, stream-to-file ingestion, projections.       |
| `apps/local-daemon/src/git`       | OTO-8                    | Worktree/branch ownership, canonical diff, cleanup primitives.        |
| `apps/local-daemon/src/api`       | OTO-9                    | Local daemon routes and SSE surface.                                  |
| `apps/local-daemon/src/supervisor`| OTO-10                   | Process supervision, pid reconciliation (lands as a daemon module).   |
| `packages/domain`                 | OTO-5                    | Pure TS. Canonical types, state machines, event envelope, contracts.  |
| `packages/db`                     | OTO-5                    | SQLite driver isolation, Drizzle schema, migrations, repositories.    |
| `packages/ui`                     | OTO-9                    | UI primitives/design system (Base UI/Tailwind/lucide).                |
| `packages/client`                 | OTO-9                    | Typed API/SSE client for the local daemon.                            |
| `packages/tooling`                | OTO-5                    | Shared TypeScript, lint/boundary, and test configuration.             |

Integrations (Linear/GitHub) and review pinning (OTO-11) start as daemon modules
when the local loop needs them; promote either to `packages/*` only if a real
cross-app consumer appears.

## Frontend Stack Direction

React, Vite, TanStack Router/Query/Form, Tailwind, Base UI (shadcn-style
primitives), lucide-react, sonner, zod, `@git-diff-view/react` for diffs, xterm for
terminal/session surfaces, and zustand only when a local UI store is actually
needed.

## Offline-First Direction

For V1, the local daemon is the offline cache: it mirrors external state into
SQLite, serves last-known state without network, and streams local updates to the
web app over SSE. The frontend uses TanStack Query + SSE. There is no IndexedDB
replica and no `frontend/store` package.
