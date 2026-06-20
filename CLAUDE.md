# CLAUDE.md

Otomat is a local-first, issue-first agent cockpit (TypeScript monorepo, pnpm).
Read **`AGENTS.md`** first — it is the canonical guide (layout, import boundaries,
code guardrails, commands, conventions, scope discipline). This file adds only
Claude-specific notes.

## Source of truth

- `AGENTS.md` — contributor/agent guide and guardrails.
- `docs/ai/codebase-map.md` — target tree and per-ticket ownership.
- `docs/ai/import-boundaries.md` — the dependency rules `pnpm build` enforces.

## Fast facts

- Packages: `apps/{web,local-daemon}`, `packages/{domain,db,runtime,events,git,ui,tooling}`.
  Other packages are added by their owning ticket, never as placeholders.
- DB: SQLite WAL + Drizzle + `better-sqlite3`, isolated behind `packages/db`.
  Canonical schema; `runs.plan_json` (no `workflow_revisions`); `issues` carry
  `source`/`source_external_id`/`synced_at`; `sync_state` for external mirroring.
- Domain: pure TS state machines (Issue/Run/StepRun/AgentSession/Review/PR),
  event envelope, zod contracts. Illegal transitions throw.

## Commands

```
pnpm install && pnpm build   # tsgo emit + boundary lint
pnpm check                   # full PR gate set
pnpm test                    # Vitest
pnpm typecheck               # tsgo --noEmit
pnpm lint                    # oxlint
pnpm guardrails              # frontend guardrails
pnpm format                  # oxfmt
pnpm db:migrate              # create/upgrade local SQLite
```

Toolchain: `tsgo` (type check + emit), `oxlint`, `oxfmt`, `lefthook` git hooks,
`dependency-cruiser` boundaries. No tsc/eslint/prettier.

## When working here

- Stay inside the active ticket's scope; one ticket per branch.
- Honor import boundaries — `pnpm build` fails on a frontend→backend import.
- Honor the code guardrails in `AGENTS.md` (no `any`, documented `useEffect`,
  no nested ternaries, no `&&` JSX, canonical Tailwind spacing).
- Keep `packages/domain` dependency-light (zod only); no Node/DOM/Drizzle there.
- No Effect, no graph tooling, no offline-first frontend store.
