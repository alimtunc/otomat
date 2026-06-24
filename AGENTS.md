# Otomat — Agent Guide

Otomat is a **local-first, issue-first agent cockpit**: launch coding agents on
isolated git worktrees from your issues, watch them live, review the real git
diff, have an agent fix your comments, then open a PR — all locally, in one pane.

This file is the canonical guide for humans and agents working in the repo:
layout, import boundaries, code guardrails, commands, conventions, and scope
discipline.

## Monorepo layout

`apps/*` are **runnable targets**, not only UI apps — `local-daemon` is a Node
process that hosts the backend as internal modules.

```
apps/
  web/                  React + Vite cockpit shell
  local-daemon/         Node local process; the backend lives here as internal modules:
    src/api/            local daemon HTTP routes + SSE handlers
    src/events/         append-only event ledger + non-lossy stream-to-file tailer
    src/git/            worktree/branch lifecycle + canonical git diff
    src/runtime/        runtime adapter contract + deterministic fake adapter
    src/{index,server,launcher,bootstrap}.ts   composition root / entrypoint
packages/
  domain/               Pure TS: types, state machines, event envelope, zod contracts
  db/                   SQLite (WAL) + Drizzle + better-sqlite3, schema/migrations/repos
  ui/                   Shared UI primitives and design system
  client/               Typed daemon API/SSE client (frontend)
  tooling/              Shared tsconfig / oxlint / vitest / dependency-cruiser presets
```

### A package must earn its place

A directory is a **package** only when it has a real reason: multiple real
consumers, an important boundary to protect, a heavy/dangerous dependency to
isolate, a stable interface between two worlds, or reuse planned across apps.
Otherwise it is an internal folder of an app/process, not a package.

- `domain` (shared by everyone), `ui`/`client` (frontend, reused by `web` and
  future apps), `tooling` (shared config), and `db` (isolates the native
  `better-sqlite3` driver + Drizzle schema, used by every backend module) each
  meet that bar.
- `api`, `events`, `git`, `runtime` were daemon-only with no cross-app consumer,
  so they are internal modules of `apps/local-daemon`, not packages. The future
  `supervisor` (OTO-10) joins them there. Promote one back to `packages/*` only
  with an explicit justification. See
  [`docs/ai/codebase-map.md`](docs/ai/codebase-map.md) for the full tree and the
  per-ticket ownership table.

## Import boundaries (enforced, not advisory)

`pnpm build` runs `dependency-cruiser`. The rules
([`docs/ai/import-boundaries.md`](docs/ai/import-boundaries.md); config in
`packages/tooling/dependency-cruiser.cjs`):

- `packages/domain` is pure: no React, DOM, Drizzle, better-sqlite3, Node-only
  builtins, or app/backend/frontend package imports.
- Frontend (`apps/web`, `ui`, `client`) must not import the backend package `db`
  or reach into `apps/local-daemon`. External state is mirrored by the local
  daemon and reaches the frontend over the typed client + SSE.
- `apps/local-daemon` and `packages/db` must not import frontend UI packages.
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

## Source & test layout

- **Tests live outside `src`.** Each module mirrors its domain:
  `<module>/src/<domain>/…` is the runtime/buildable code, `<module>/tests/<domain>/…`
  holds its tests, and shared fixtures/helpers go in `<module>/tests/support/…`.
  `src` contains only code that ships; tsconfig builds `src` only, Vitest collects
  `tests/**/*.test.ts`.
- **Reach source from tests, and reach one daemon module from another, through
  Node subpath imports — never a deep relative (`../../…`, banned by oxlint).**
  - In `apps/local-daemon`, each internal module is consumed through its public
    index: `#api`, `#events`, `#git`, `#runtime` (and `#api/<file>` for a specific
    file). Within a module, use shallow relative imports.
  - In every other package, tests reach source via `#<pkg>/<path>` (e.g.
    `#domain/state-machines/machine`, `#db/client`, `#client/types`) — the
    private mirror of the package's public `@otomat/<pkg>` entry. The map is the
    package's `imports` field in `package.json` and stays private to that package.
- **The daemon runs from source in dev and from `dist` in prod — both are real
  modes.** `start` runs `tsx src` (the `#`-imports resolve to `src/*.ts`). `pnpm
  build` bundles the daemon with `tsdown` (Rolldown + oxc): internal `#` modules are
  inlined and `node_modules` deps stay external, so `start:dist` runs a plain
  `node dist/index.js`. `smoke:dist` boots the built dist and asserts `/api/health`,
  and CI runs it right after the build so the emitted artifact can never silently rot.
- **Types/constants/helpers have a home, not a junk drawer.** Domain types live in
  the module that owns them and are re-exported from a thin barrel (e.g.
  `packages/domain/src/types.ts`); there is no global mixed `types.ts`. A
  component's own `*Props` stay with the component. Constants live in an explicitly
  named file next to their use. Shared UI helpers live in `packages/ui/src/lib`
  (`cn`, date, status, theme); components and primitives never live there.

## Scope discipline

Work one ticket at a time on its branch. Do not create files or packages outside
the current ticket's scope. Set the tracker issue `In Progress` at start and
propose a commit only when every acceptance criterion passes.
