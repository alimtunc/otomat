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
    src/{agents,api,context,data-safety,diagnostics,events,git,review,runtime,supervisor}/
  desktop/              Electron shell: manages the daemon lifecycle, serves the web build
    src/{main,preload,shared}/
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

`agents`, `api`, `context`, `data-safety`, `diagnostics`, `events`, `git`, `review`,
`runtime`, and `supervisor` stay internal to `apps/local-daemon` while they have
no cross-app consumer. Promoting one requires an explicit current justification.

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
`scripts/import-boundaries.mjs`. Read the relevant configuration when a
gate fails instead of duplicating its policy here.

## Code quality

Non-negotiable for every coding agent and harness that changes this repository,
on first attempts, added steps, and follow-ups alike.

- Default to zero comments. A new comment is justified only by a non-obvious
  _reason_ the code cannot express: an invariant, an ordering constraint, an
  external limitation or workaround, a rejected alternative. Never restate the
  code, narrate what a function does, or argue a design in prose; design
  rationale belongs in `docs/ai/codebase-map.md`. One line is the norm, and a
  fact is written in exactly one place — not repeated on every layer that
  forwards it. Exported symbols get no exemption: a signature that already
  reads clearly gets no doc comment, and JSDoc that restates one is noise.
  Directives a gate relies on (`oxlint-disable-*`, `@ts-expect-error`) are tool
  configuration, not prose — keep them, with their reason attached.
- Extract repeated logic at its third occurrence, not before; two policies that
  merely coincide stay separate. No single-call-site wrappers, one-method
  services, extension points, or config knobs without a consumer today.
- Separate concerns: a function or module owns one responsibility. Mixing
  transport, domain logic, and rendering in one place is a defect even when it
  works; split along the seams the module layout already draws.
- Write idiomatic React: reuse the primitives in `packages/ui` and the frontend
  stack already in place instead of hand-rolling alternatives; keep state where
  it is used and derive values instead of mirroring them; add memoization,
  context, or an abstraction layer only for a need that exists today. A failed
  refresh with retained query data renders the data behind the stale-notice
  boundary (`QueryBoundary`/`QueryList`); a blocking error state is only for a
  query with no data. A mutation that returns the created entity seeds the
  caches it invalidates with that entity before invalidating them.
- Never swallow errors. Avoid `catch {}`, `.catch(() => {})`, and optional
  chaining that hides error-created absence. Logging is not handling: an
  operation that catches a failure and still acknowledges success has swallowed
  it — persist first, then acknowledge, and carry the failure in the returned
  result. Expose useful loading, error, and empty states.
- Cast only after validation or in narrow idioms such as `as const` and
  `as unknown`. Define each union or enum once, and type contractual values as
  non-null.

### File ownership (enforced by `pnpm guardrails`)

- A `.tsx` file exports exactly one component, plus at most its compound
  subcomponents (`Card` → `CardHeader`) and their `*Props` types. Helper
  functions, constant tables, data shapes, and unrelated components each live in
  their own module.
  - Bad: `status-chip.tsx` exporting `StatusChip` plus 8 preset chips.
  - Bad: `project-switcher.tsx` exporting the `ProjectSummary` data shape.
  - Good: `lib/provider-mark-art.ts` — one data table plus its type.
- A `use-*.ts` file exports exactly one hook plus its option/result types. A
  pure function both the hook and a component need goes in a sibling `.ts`
  module, imported by both.
- Non-exported single-consumer constants and helpers (≤10 lines) may sit above
  their component. The moment a second file needs one, move it to the owning
  domain module — never export it from a `.tsx` or `use-*` file.
- An `index.ts` barrel contains re-export statements only.
- Three or more sibling files sharing a domain prefix (`run-*.ts`) become a
  domain folder (`run/`). Never create a one-file folder.
- Runtime `.ts` and `.tsx` files stay at or below 250 physical lines. Exceptions
  live in `scripts/source-size-baseline.json`, `scripts/export-shape-baseline.json`,
  and `scripts/structure-baseline.json`; entries only shrink — CI rejects new or
  raised entries.
- Shared UI helpers live in `packages/ui/src/lib`; domain types live with their
  owning module and are re-exported through thin barrels.

Why: a file that owns one thing can be understood, tested, and replaced without
loading unrelated concerns; the gates check shape so prose only has to carry
judgment.

### Final diff pass (mandatory)

Before declaring any change done, re-read the full diff and check each point.
Fix what fails; report anything left as an explicit open violation, never
silently.

1. Comments — every new comment passes the rule above; delete the rest. Report
   `New comments: <n>`, with `file:line — justification` for each one kept.
2. Duplication — nothing in the diff repeats existing code or another hunk of
   the same diff.
3. Concerns — no file gained a second responsibility; new helpers landed in
   their owning module, not where they were first needed.
4. Ownership — the file-ownership rules above hold without new baseline
   entries.
5. Over-engineering — every abstraction, option, and export introduced has a
   consumer today.

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
pnpm clean:data    # wipe this checkout's dev data (--vps <alias>, --repo <path>, --dry-run)
pnpm desktop:dev      # run the Electron shell in dev (Vite + a spawned daemon)
pnpm desktop:package  # build the unsigned macOS .app/.dmg
pnpm desktop:preflight # check the release inputs without building anything
pnpm desktop:release  # build the signed, notarized macOS release (needs Apple credentials)
pnpm desktop:smoke    # install/launch/shutdown smoke on the packaged artifact
```

After a schema change, regenerate migrations with
`pnpm --filter @otomat/db run generate`.

The desktop shell (`apps/desktop`) composes existing builds: it launches the
`local-daemon` on a free loopback port, waits for `/api/health`, then serves the
packaged `apps/web` build over an `app://` scheme with the daemon URL injected. It
never imports the daemon or a backend package. Distribution is documented in
[`docs/release/macos-alpha.md`](docs/release/macos-alpha.md): the local build is
ad-hoc signed and undistributable, and the release build fails closed rather than
falling back to it when Apple credentials are missing.

## Toolchain

Use the scripts in `package.json`; they are the source of truth. This repository
uses `tsgo`, `oxlint`, `oxfmt`, Vitest, and Lefthook, with a dep-free import-
boundary gate (`scripts/import-boundaries.mjs`). Do not substitute `tsc`, ESLint,
or Prettier.

## Verify as you go

Fastest loop first, full gate last:

```
pnpm --filter @otomat/local-daemon test tests/api/app.test.ts   # one file, seconds
pnpm --filter @otomat/local-daemon test                         # one package
pnpm typecheck && pnpm lint && pnpm guardrails                  # cross-cutting
pnpm check                                                      # before "done"
```

Gotcha: `pnpm --filter X test -- path` (with `--`) silently runs the whole suite;
pass the path without `--`. Apps typecheck against package `dist`, not src — after
changing a package's public surface, run `pnpm build` before `pnpm typecheck`.

## Environment gotchas

- `pnpm install` exits 1 when native builds are ignored; `better-sqlite3` ships
  its own N-API prebuilds, so `pnpm rebuild better-sqlite3` restores a missing
  binary. CI is authoritative.
- The pre-push hook typechecks against `packages/domain/dist`, not src — run
  `pnpm build` before pushing a contract change. It does not run the tests; CI
  does, so run `pnpm check` yourself before calling a change done.
- Parallel `pnpm install` across worktrees can race (ENOTEMPTY); retry serially.

## Conventions

- TypeScript only, using idiomatic async/await and try/catch. Do not introduce
  Effect; the project has one async/error model to keep control flow legible.
- A callable declared inside a function body is an arrow function bound to a
  `const` (`const save = (phase: Phase): void => { … }`), never a nested
  `function` declaration: it reads as a value closing over local state and
  cannot be called above its own definition. `function` declarations stay at
  module level, where the repo uses them for exported components and helpers.
- Domain state changes go through `packages/domain/src/state-machines`. Illegal
  transitions throw `IllegalTransitionError`; centralization keeps invariants and
  failure behavior identical for every caller.
- The daemon is the only canonical writer. Do not add schedulers, leases, outbox
  or idempotency tables. `runs.plan_json` is frozen at launch and then append-only
  (`appendPlanStep`): a revision adds a node and is journaled as `run.plan_revised`,
  never rewriting or dropping a launched one, so ordering and recovery stay
  deterministic and the history stays auditable.
- An issue owns one canonical workspace — one run, one branch, one worktree —
  while its work is unmerged. New work on it appends a step to that run; a second
  launch is refused (`issue_workspace_open`) rather than forking a competing
  worktree. A failure, a cancel or a lost provider session leaves that cycle open
  and resumable; only a confirmed merge or an explicit abandon closes it, and the
  next launch then starts a fresh cycle. Abandoning stamps the run and stops the
  plan — it never deletes a branch, a worktree or a commit.
- A prompt is declarative, never copied text. A step names what it works from —
  its issue, further issues, repository files — and adds at most one optional
  note; Otomat resolves those references itself and never invents an
  instruction, a profile, a role or a built-in agent. A node's name is a label
  the daemon must not turn into a directive, and no surface may put an agent's
  guidance or an issue's body into an editable field.
- Queries answer, commands mutate: a read operation (list/get/status) never
  triggers lifecycle side effects. Deliberately unawaited work is dispatched
  from a state transition or an explicit command, and concurrent writes to one
  external resource are ordered per resource with an in-memory chain — the
  daemon is a single process.
- When a behavior has a composed sequence (advance → deliver queued
  contributions → cancel undeliverable), every path that needs it invokes the
  whole composition; re-assembling a subset is how queues silently stall.
- Everything one response derives from a worktree — diff, anchor validation,
  expanded blobs, prompt context — reads from a single captured `{base, tree}`
  snapshot (`diffSnapshot`). Never pair content from two separately computed
  trees, and never read worktree files through `fs` into provider prompts: a
  changed path can be a symlink to a host file.
- The API layer consumes daemon modules through their service seams
  (`Supervisor`, `ReviewService`, `LinearService`, …); `ApiDeps` carries module
  handles, never re-declared per-method fields.

## Source and test layout

- Runtime code lives in `<module>/src`; tests mirror it in
  `<module>/tests/<domain>`, with shared test support in `<module>/tests/support`.
- Tests and daemon modules use public Node subpath imports, never deep relative
  imports. Daemon modules expose `#agents`, `#api`, `#context`, `#data-safety`,
  `#diagnostics`, `#events`, `#git`, `#github`, `#linear`, `#review`,
  `#runtime`, and `#supervisor`; other packages expose private `#<package>/<path>`
  test maps.
- The daemon must work from source and from `dist`. Its production build is
  bundled by `tsdown`; `smoke:dist` protects the emitted artifact.
- Domain types live with their owning module and are re-exported from thin
  barrels. Component props stay with the component. Named constants stay next to
  their use. Shared UI helpers belong in `packages/ui/src/lib`; components and
  primitives do not.

## Protocol

- Work one ticket at a time on its branch, inside its acceptance criteria.
  Preserve unrelated local changes.
- When a tracker is connected with write access, set the issue to `In Progress`
  at the start; otherwise continue locally and report the gap.
- Done = every acceptance criterion satisfied, the final diff pass reported,
  and `pnpm check` green. Separate regressions caused by the change from
  reproducible baseline failures; if an environment failure blocks a gate,
  report the exact command and output.
- Do not commit, push, open a PR, or change tracker state beyond `In Progress`
  unless the user explicitly asks. Propose the commit only after verification.
