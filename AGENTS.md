# Otomat — Agent Guide

Otomat is a **local-first, issue-first agent cockpit**: launch coding agents on
isolated git worktrees from issues, watch them live, review the real git diff,
resume them to address comments, then open a PR — all locally, in one pane.

This file contains the durable rules that every coding agent needs. Detailed
architecture belongs in [`docs/ai/codebase-map.md`](docs/ai/codebase-map.md), and
enforced import rules belong in
[`docs/ai/import-boundaries.md`](docs/ai/import-boundaries.md).

## Monorepo layout

`apps/*` are runnable targets. Daemon-only backend capabilities are internal
modules of `apps/local-daemon`, not workspace packages.

```
apps/
  web/                  React + Vite cockpit
  local-daemon/         Node backend process
    src/{api,events,git,review,runtime,supervisor}/
packages/
  domain/               Pure TypeScript domain model and contracts
  db/                   SQLite, Drizzle, and better-sqlite3 boundary
  ui/                   Shared UI primitives and design system
  client/               Typed daemon HTTP/SSE client
  tooling/              Shared build, lint, test, and boundary configuration
```

### A package must earn its place

Create a package only for an existing cross-app consumer, an important boundary,
a dangerous dependency that must be isolated, or a stable interface between two
current systems. Reuse that is merely planned is not sufficient.

`api`, `events`, `git`, `review`, `runtime`, and `supervisor` stay internal to
`apps/local-daemon` while they have no cross-app consumer. Promoting one requires
an explicit current justification.

## Import boundaries

- `packages/domain` stays pure: no React, DOM, Drizzle, `better-sqlite3`, Node-only
  builtins, app imports, or backend/frontend package imports.
- Frontend code (`apps/web`, `packages/ui`, `packages/client`) must not import
  `packages/db` or reach into `apps/local-daemon`; daemon state arrives through
  the typed client and SSE.
- `apps/local-daemon` and `packages/db` must not import frontend UI packages.
- Construct `better-sqlite3` only in `packages/db/src/client.ts`.

Why: these boundaries keep the domain portable, isolate the native database
driver, and preserve the daemon as the only bridge between backend state and UI.

## Code guardrails

`pnpm check` is the authoritative gate. It runs formatting checks, lint,
frontend guardrails, build and dependency boundaries, typecheck, the built-daemon
smoke test, and all tests. Never bypass or weaken a gate to make a change pass.

The machine-enforced rules live in `.oxlintrc.json`,
`packages/tooling/oxlintrc.base.json`, `scripts/guardrails.mjs`, and
`packages/tooling/dependency-cruiser.cjs`. Read the relevant configuration when a
gate fails instead of duplicating its policy here.

## Code quality

- Search for an existing helper before writing one. Extract repeated code at its
  third occurrence, not before; two policies that merely coincide stay separate.
- Prefer intent-revealing names. Avoid generic names such as `data`, `info`,
  `util`, `helper`, `temp`, or `result` when the role is knowable.
- Treat roughly 40 lines, three nesting levels, and five parameters as prompts to
  split a function, not targets to game.
- Before adding a branch, mode, flag, or layer, look for a state or ownership
  model that deletes the special case.
- A renderer renders, a hook orchestrates, and a utility computes. Split a unit
  that branches on more than two distinct shapes or modes.
- Do not add single-call-site wrappers, one-method services, extension points,
  config knobs, or polymorphic parameters without a consumer today.
- Never swallow errors. Avoid `catch {}`, `.catch(() => {})`, and optional
  chaining that hides error-created absence. Expose useful loading, error, and
  empty states.
- Cast only after validation or in narrow idioms such as `as const` and
  `as unknown`. Define each union or enum once, and type contractual values as
  non-null.
- Default to zero comments. Add one short comment only to explain a genuinely
  non-obvious reason.

## Commands

```
pnpm install       # install the workspace and git hooks
pnpm build         # emit packages and check dependency boundaries
pnpm test          # run Vitest across the workspace
pnpm typecheck     # run tsgo --noEmit across the workspace
pnpm lint          # run oxlint
pnpm format        # write oxfmt formatting
pnpm guardrails    # run frontend-specific static checks
pnpm check         # run the complete PR gate, including smoke:dist
pnpm db:migrate    # apply Drizzle migrations to local SQLite
```

After a schema change, regenerate migrations with
`pnpm --filter @otomat/db run generate`.

## Toolchain

Use the scripts in `package.json`; they are the source of truth. This repository
uses `tsgo`, `oxlint`, `oxfmt`, Vitest, Lefthook, and dependency-cruiser. Do not
substitute `tsc`, ESLint, or Prettier.

## Conventions

- TypeScript only, using idiomatic async/await and try/catch. Do not introduce
  Effect; the project has one async/error model to keep control flow legible.
- Domain state changes go through `packages/domain/src/state-machines`. Illegal
  transitions throw `IllegalTransitionError`; centralization keeps invariants and
  failure behavior identical for every caller.
- The daemon is the only canonical writer. Do not add schedulers, leases, outbox
  or idempotency tables. `runs.plan_json` is frozen at launch so ordering and
  recovery remain deterministic.

## Source and test layout

- Runtime code lives in `<module>/src`; tests mirror it in
  `<module>/tests/<domain>`, with shared test support in `<module>/tests/support`.
- Tests and daemon modules use public Node subpath imports, never deep relative
  imports. Daemon modules expose `#api`, `#events`, `#git`, `#review`, `#runtime`,
  and `#supervisor`; other packages expose private `#<package>/<path>` test maps.
- The daemon must work from source and from `dist`. Its production build is
  bundled by `tsdown`; `smoke:dist` protects the emitted artifact.
- Domain types live with their owning module and are re-exported from thin
  barrels. Component props stay with the component. Named constants stay next to
  their use. Shared UI helpers belong in `packages/ui/src/lib`; components and
  primitives do not.

## Working protocol

- Before editing, inspect git status, the relevant implementation and tests, and
  the acceptance criteria. Preserve unrelated user changes.
- For multi-step work, maintain a plan with one active step. Work in bounded,
  verifiable checkpoints and update the plan when evidence changes it.
- Keep requirements, decisions, and final evidence in the main thread. Delegate
  only independent exploration, log analysis, or tests; never give two agents
  overlapping write scope.
- Continue until the stated outcome and definition of done are satisfied. Do not
  stop after scaffolding, a partial implementation, or a passing typecheck.
- Diagnose failures with evidence. Separate regressions caused by the change from
  reproducible baseline failures, and never silently ignore either.

## Scope discipline and definition of done

- Work one ticket at a time on its branch. Do not create files, packages, modes,
  or abstractions outside the ticket's acceptance criteria.
- When a tracker is connected and write access is authorized, set the issue to
  `In Progress` at the start. Otherwise continue locally and report the missing
  tracker update; do not block implementation on unavailable integration.
- Before reporting completion, satisfy every acceptance criterion, run targeted
  tests, then run `pnpm check`. If an environment or reproducible baseline failure
  prevents a gate, report the exact command and failure.
- Do not commit, push, open a PR, or change tracker state beyond `In Progress`
  unless the user explicitly asks. Propose the commit only after verification.
