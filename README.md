# Otomat

Otomat is a **local-first, issue-first agent cockpit**. From an issue, you launch
coding agents on isolated git worktrees, watch them run live, review the real git
diff, have an agent address your review comments, and open a pull request — all
locally, in a single pane.

It is a TypeScript monorepo managed with pnpm. The product is built ticket by
ticket; packages appear when their owning ticket has real code to put in them, not
as empty placeholders.

## Monorepo layout

```
apps/
  web/            React + Vite cockpit shell
  local-daemon/   Node local process (API, runtime host, supervision)
packages/
  domain/         Pure TS: types, state machines, event envelope, zod contracts
  db/             SQLite (WAL) + Drizzle + better-sqlite3, schema/migrations/repos
  runtime/        Runtime adapter contract + deterministic fake adapter
  events/         Append-only event ledger + non-lossy stream-to-file tailer
  git/            Worktree/branch lifecycle + canonical git diff
  ui/             Shared UI primitives and design system
  tooling/        Shared tsconfig / oxlint / vitest / dependency-cruiser presets
```

The full target tree and per-ticket ownership live in
[`docs/ai/codebase-map.md`](docs/ai/codebase-map.md). The enforced dependency
rules are in [`docs/ai/import-boundaries.md`](docs/ai/import-boundaries.md). A
traced walkthrough of a run's lifecycle (start → worker → settle, with resume,
fix, and abort) is in [`docs/ai/run-lifecycle.md`](docs/ai/run-lifecycle.md).

## Getting started

```
pnpm install        # install workspace (also installs git hooks via lefthook)
pnpm build          # build every package, then run the import-boundary lint
pnpm test           # Vitest across packages
pnpm db:migrate     # create/upgrade the local SQLite database
```

## Quality gates

`pnpm check` runs the full set the CI enforces on every pull request:

```
pnpm format:check   # oxfmt (import order + formatting)
pnpm lint           # oxlint
pnpm guardrails     # frontend guardrails (see AGENTS.md)
pnpm typecheck      # tsgo --noEmit across packages
pnpm build          # build + import-boundary lint
pnpm test           # Vitest across packages
```

CI (`.github/workflows/ci.yml`) runs these on pushes to `main` and on pull
requests. Dependency updates are managed by Dependabot
(`.github/dependabot.yml`).

## Toolchain

- **Type check + emit:** `tsgo` (`@typescript/native-preview`), not `tsc`.
- **Lint:** `oxlint`. **Format:** `oxfmt`. No ESLint, no Prettier.
- **Boundaries:** `dependency-cruiser` (runs inside `pnpm build`).
- **Git hooks:** `lefthook`.

See [`AGENTS.md`](AGENTS.md) for the contributor and agent guide: import
boundaries, code guardrails, conventions, and scope discipline.
