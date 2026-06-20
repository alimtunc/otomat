# Otomat — Agent Guide

Otomat is a **local-first, issue-first agent cockpit**: launch coding agents on
isolated git worktrees from your issues, watch them live, review the real git
diff, have an agent fix your comments, then open a PR — all locally, in one pane.

This file is the canonical guide for humans and agents working in the repo:
layout, import boundaries, code guardrails, commands, conventions, and scope
discipline.

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

Packages stay flat under `packages/*`. `api`, `client`, `domains`, `supervisor`,
`integrations`, and `review` are **created by their owning ticket** when they hold
real code — never as placeholders. See
[`docs/ai/codebase-map.md`](docs/ai/codebase-map.md) for the full target tree and
ownership table.

## Import boundaries (enforced, not advisory)

`pnpm build` runs `dependency-cruiser`. The rules
([`docs/ai/import-boundaries.md`](docs/ai/import-boundaries.md); config in
`packages/tooling/dependency-cruiser.cjs`):

- `packages/domain` is pure: no React, DOM, Drizzle, better-sqlite3, Node-only
  builtins, or app/backend/frontend package imports.
- Frontend (`apps/web`, future `ui`/`client`/`domains`) must not import a backend
  package (`db`, `runtime`, `events`, `git`, `api`, `supervisor`, `integrations`,
  `review`). External state is mirrored by the local daemon.
- Backend packages must not import frontend UI packages.
- `better-sqlite3` is constructed only inside `packages/db` (`src/client.ts`).

## Code guardrails (enforced by lint + `pnpm guardrails`)

`oxlint` (config: `packages/tooling/oxlintrc.base.json`) enforces, as **errors**:

- no explicit `any` (`typescript/no-explicit-any`);
- no nested ternaries (`no-nested-ternary`) — extract a named variable, a pure
  helper, a variant map, or an early return;
- no deep relative imports (`../../+`) and no direct `@radix-ui/*` imports — use a
  workspace package entry (`@otomat/*`) and the primitives in `@otomat/ui`.

`pnpm guardrails` (`scripts/guardrails.mjs`) covers the frontend rules oxlint
cannot express, over `apps/web/src` and `packages/ui/src`:

- **No undocumented `useEffect`.** `useEffect` is banned by default. When one is
  genuinely required, put an `// otomat-allow-effect: <reason>` comment directly
  above the call.
- **No `&&` conditional rendering.** Use `condition ? <Component /> : null`, not
  `condition && <Component />`.
- **Canonical Tailwind spacing.** Arbitrary integer-px spacing is banned: use the
  canonical numeric utility (`px / 4`, decimals allowed on Tailwind v4's dynamic
  scale) — `w-[260px]` → `w-65`, `gap-[10px]` → `gap-2.5`, `px-[7px]` → `px-1.75`.
  Non-px units, sub-pixel values, and CSS-variable spacing stay allowed.

Import order and formatting are handled by `oxfmt` (`.oxfmtrc.json`,
`sortImports`) and verified by `pnpm format:check`.

## Commands

```
pnpm install       # install workspace (also installs git hooks via lefthook)
pnpm build         # tsgo emit per package, then run the boundary lint
pnpm test          # Vitest across packages
pnpm typecheck     # tsgo --noEmit across packages
pnpm lint          # oxlint (apps + packages)
pnpm format        # oxfmt write; format:check to verify
pnpm guardrails    # frontend guardrails check
pnpm check         # the full PR gate set (format:check, lint, guardrails, typecheck, build, test)
pnpm db:migrate    # apply Drizzle migrations -> SQLite (.data/otomat.db by default)
```

Regenerate migrations after a schema change: `pnpm --filter @otomat/db run generate`.

CI (`.github/workflows/ci.yml`) runs the same gates on every push to `main` and
every pull request. Dependency updates come through Dependabot
(`.github/dependabot.yml`).

## Toolchain

- **Type checking + emit:** `tsgo` (`@typescript/native-preview`), not `tsc`.
- **Lint:** `oxlint` (root `.oxlintrc.json` extends the tooling base). No ESLint.
- **Format:** `oxfmt` (markdown is not formatted). No Prettier.
- **Git hooks:** `lefthook` (`lefthook.yml`) — pre-commit lints + format-checks
  staged files; pre-push runs typecheck + boundaries + tests.
- **Boundaries:** `dependency-cruiser` (in `pnpm build`).

## Conventions

- TypeScript only. Idiomatic async/await + try/catch. **No Effect.**
- Comments are rare: names and types document the _what_; a one-line comment only
  for a non-obvious _why_.
- Domain state changes go through the centralized machines in
  `packages/domain/src/state-machines`; illegal transitions throw
  `IllegalTransitionError`. Do not hand-roll transition checks elsewhere.
- One canonical writer (the daemon). No scheduler/leases/outbox/idempotency
  tables — `runs.plan_json` is the plan frozen at launch.

## Scope discipline

Work one ticket at a time on its branch. Do not create files or packages outside
the current ticket's scope. Set the tracker issue `In Progress` at start and
propose a commit only when every acceptance criterion passes.
