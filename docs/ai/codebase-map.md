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
      data-safety/     # startup diagnostics + restore maintenance mode (OTO-29)
      diagnostics/     # correlation-id request log + bounded redacted excerpt   (OTO-52)
      review/          # review slice: diff snapshot + comment anchoring (OTO-11)
      runtime/         # adapter contract, provider adapters, model + option feature detection (OTO-6)
        probe/         # bounded, credential-free reads of an installed provider binary
        providers/     # one folder per runtime: adapter, frames, models, options
      supervisor/      # process supervisor + pid reconciliation (OTO-10)
      index.ts server.ts bootstrap.ts   # composition root / entrypoint
    tests/             # agents/ api/ data-safety/ events/ git/ runtime/ supervisor/ + support/
  desktop/             # Electron alpha shell: manages the local-daemon lifecycle, serves the web build
    src/
      main/            # app lifecycle, daemon spawn, data layout/recovery, logs, support export
        remote/        # remote execution host: ssh tunnel, remote daemon start-or-verify, host selection
      preload/         # contextBridge preloads (cockpit + splash)
      shared/          # pure lifecycle logic (free port, PATH resolve, health poll, env, terminate)

packages/
  domain/              # pure TS domain, state machines, event envelope, zod contracts (OTO-5)
  db/                  # better-sqlite3 + Drizzle schema/migrations/repositories (OTO-5)
  ui/                  # Base UI primitives + Otomat design system (OTO-9)
  client/              # typed daemon API/SSE client for the frontend (OTO-9)
  tooling/             # shared tsconfig, lint, vitest/build/boundary presets (OTO-5)

apps/ (later)
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

Why `api`, `data-safety`, `diagnostics`, `events`, `git`, `runtime` are **not** packages: each was
consumed only by the local daemon (and each other) — no frontend or cross-app consumer — so they
are internal daemon modules, consumed through
`#api`/`#data-safety`/`#diagnostics`/`#events`/`#git`/`#runtime` subpath imports.
`supervisor` (OTO-10) and `review` (OTO-11) live the same way under
`apps/local-daemon/src/<module>`, consumed through `#supervisor`/`#review`.

## Ticket Ownership

| Path                              | Owner                    | Notes                                                                 |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `apps/web`                        | OTO-5, OTO-9, OTO-15     | Vite/React cockpit; file-based routing + domain-split components.     |
| `apps/local-daemon`               | OTO-5, OTO-9/10, OTO-13  | Local process host; backend modules folded in by OTO-13.              |
| `apps/local-daemon/src/runtime`   | OTO-6                    | Push-sink adapter contract and fake adapter.                          |
| `apps/local-daemon/src/events`    | OTO-7                    | Append-only event store, stream-to-file ingestion, projections.       |
| `apps/local-daemon/src/git`       | OTO-8                    | Worktree/branch ownership, canonical diff, cleanup primitives.        |
| `apps/local-daemon/src/data-safety` | OTO-29                 | Safe startup diagnostics and the one-shot restore maintenance mode.   |
| `apps/local-daemon/src/diagnostics` | OTO-52                 | Correlation ids on `/api`, and the bounded redacted excerpt a host serves. |
| `apps/web/src/components/diagnostics` | OTO-52               | Classified error report: details, host log excerpt, copy/export/report. |
| `packages/domain/src/redaction`   | OTO-29, OTO-52           | The one log redactor; shared by the shell, the daemon and the cockpit. |
| `apps/local-daemon/src/api`       | OTO-9                    | Local daemon routes and SSE surface.                                  |
| `apps/desktop/src/main/data-safety` | OTO-29                 | Versioned data layout, redacted rotating logs, support bundle export. |
| `apps/desktop/scripts`            | OTO-21, OTO-30           | macOS packaging: ad-hoc local build, signed/notarized release, packaged smoke. |
| `apps/local-daemon/src/supervisor`| OTO-10                   | Process supervision, pid reconciliation (lands as a daemon module).   |
| `apps/local-daemon/src/review`    | OTO-11                   | Review slice: server-side diff snapshot, comment anchoring, fix-step context.|
| `packages/domain`                 | OTO-5                    | Pure TS. Canonical types, state machines, event envelope, contracts.  |
| `packages/db`                     | OTO-5                    | SQLite driver isolation, Drizzle schema, migrations, repositories.    |
| `packages/ui`                     | OTO-9                    | UI primitives/design system (Base UI/Tailwind/lucide).                |
| `packages/client`                 | OTO-9                    | Typed API/SSE client for the local daemon.                            |
| `packages/tooling`                | OTO-5                    | Shared TypeScript, lint/boundary, and test configuration.             |

Integrations (Linear/GitHub) start as daemon modules when the local loop needs
them; review pinning (OTO-11) already landed as `apps/local-daemon/src/review`.
Promote a module to `packages/*` only if a real cross-app consumer appears.

## Provider Capability Detection

Otomat never ships a union of runtime options assumed valid across CLI versions.
`runtime/probe` runs the installed binary's own `--help` and bundled catalog —
locally, bounded, with no credentials or network — and caches each answer by the
binary's path, size and mtime, so a CLI upgrade re-probes on the next launch.
Each provider's `options.ts` turns that output into `ProviderOptionDescriptor`s
for the runtime and, where the provider scopes them that way, the selected model
(Codex publishes reasoning levels per model). A non-`ok` detection carries no
options and the runtime still launches on its provider defaults.

Those descriptors are the single source for three gates: the daemon refuses a
profile option the installed binary does not announce (`option_unsupported`, in
`agents/resolve.ts`), `GET /api/runtimes/:id/options` serves them to the cockpit,
and the profile and launch surfaces render fields from them without any
per-provider branch. The effective options are frozen into the run plan at launch
and replayed verbatim on resume and follow-up.

Effort is the one option a launch also sets per run and per plan node, under
whichever key the runtime announces it by (`effortOptionDescriptor`). A node
names its own level, inherits the run's, or keeps the level of the agent it
resolves to; `supervisor/freeze-plan.ts` collapses those three into the one level
frozen into the node's config, and the workflow launcher shows the resolved level
with its provenance beside every step.

## Run Steering and Deferred Messages

A user message is a durable intention attached to one **step**, never to the run
at large: steps own separate conversations, so `run_contributions.step_run_id` is
`NOT NULL` and the composer posts an explicitly resolved step id. Its lifecycle is
`queued → delivered → acknowledged`, with `failed` and `canceled` as the other
landings. `delivered` requires persisted evidence that a turn carrying the message
was launched, and `acknowledged` requires that turn to have finished — neither is
ever reached from a UI click, so the cockpit cannot claim a message was read.

Delivery has one mechanism. `supervisor/lifecycle.ts` claims the target step's
pending queue inside `spawnTurn`, after the start gate is cleared and before the
provider is spawned, and composes the effective prompt with
`withCarriedContributions`. Every turn therefore carries whatever was waiting for
its step: a message sent while the run waits for capacity rides the step's *first*
turn, and a message sent to a live session rides its next one.
`contribution/deliver.ts` only adds the case where the queue is the entire reason
to spawn — a resting run's follow-up — and it claims first so the same spawn path
resolves it.

Because the claim is the unit of delivery, restart recovery is a question about
one turn: `contribution/reconcile.ts` promotes a crash-time claim to `delivered`
only when that turn's own start gate was consumed, and returns it to the queue
otherwise. That is what makes a replay idempotent — a message is never delivered
twice, and never buried as delivered by a worker that never ran.

`RuntimeCapabilities.steering` is a guarantee level (`turn_boundary` or
`unsupported`), not a boolean, because no supported CLI can interrupt a turn in
flight. Claude Code and Codex both resume a recorded session with a new prompt, so
both declare `turn_boundary` and owe the same product contract; the label names
the level instead of a bare yes/no, and a runtime that declared `unsupported`
would be refused at the composer instead of queueing forever.

## Linear Issue Freshness

The mirror is refreshed by app-driven incremental reads, not webhooks; missed
events are recovered by the overlapping cursor reads. The daemon owns the mechanism
(`linear/sync.ts` reads by cursor, `linear/sync-runs.ts` deduplicates concurrent
passes and remembers how the last one ended, `GET /api/linear/sync-status` serves
it per project); the cockpit owns the triggers (`use-linear-auto-sync.ts` for
connection, project and foreground transitions, the Issues view for stale entry
and the explicit **Refresh issues** control). A sync always names a project, and
the daemon refuses a project it does not own rather than reporting an empty
success — that is what keeps a VPS project from silently reading local state.

## Linear Run-Lifecycle Mirror

The daemon's own canonical transitions drive the linked Linear issue, never the
UI. Creating a run signals `in_progress` the moment its row is durable — before
any concurrency slot, so a `queued` run still marks its issue started — and
appending a step re-asserts it, which is what reopens an issue somebody closed in
Linear while the work is unmerged. Only `closeMergedRun` signals `done`, so a
completed, failed, canceled, interrupted or review-waiting run never closes
anything (`supervisor/issue-lifecycle.ts` carries the signal; `linear/lifecycle.ts`
resolves and applies it).

Which state a phase means is per source, not per Otomat: `issue_sources` stores
the team's own `in_progress`/`done` workflow states, picked in Settings from the
live workspace, and an unmapped phase writes nothing rather than guessing a label.
Every assertion is one `lifecycle` row in the Linear write ledger — asserted
against the live remote state, so a matching issue costs no mutation — which is
what gives the cockpit a last sync state, a target state name, an actionable error
and a Retry, and what makes `linear.lifecycle_synced` refresh the rail without a
navigation.

## Error Diagnostics

Otomat never shows a bare error string. Every incident is classified first —
`renderer`, `daemon`, or `transport` — because the three have different evidence:
a renderer exception appears in no daemon log, and a transport failure never
reached a host at all. `packages/client` makes the distinction real: a non-2xx
answer throws `DaemonRequestError` carrying the daemon's correlation id, and a
request that never landed throws `DaemonTransportError`.

The daemon stamps `x-otomat-correlation-id` on every `/api` response and keeps a
bounded, redacted ring of what it recorded about the failures.
`GET /api/diagnostics/logs?correlation_id=…` serves only the lines for that one
request; there is no route for an unfiltered log, the database, or run output.

`redactLogText` (`packages/domain/src/redaction`) is the single redactor: the
shell's rotating logs and support bundle, the daemon's ring, and the cockpit's
message and stack all pass through it, and it is idempotent so re-redacting on
export never destroys the surrounding diagnostics. Copy, export and report are
explicit user actions — the report previews its exact text and only opens a
draft once confirmed. There is no telemetry and no automatic send.

## Issue Workspace and Plan Revisions

An issue owns one canonical workspace while its work is unmerged: the run that
still holds a non-terminal status and an `active` worktree row. `projectIssueWorkspace`
reduces the same evidence the execution projection reads, so the daemon and the
cockpit answer "where does this issue work?" identically. A second launch on that
issue is refused with `issue_workspace_open` before any row is written; new work
appends a step instead. Merging drives the run terminal and releases the worktree,
which closes the workspace and lets the next launch start a fresh cycle.

`runs.plan_json` is frozen at launch and then append-only. `appendPlanStep` copies
every launched node untouched and may only add one whose dependencies already
exist, so the graph stays acyclic and `readyPlanWork`/`settleRun` keep reading the
same shape. Each revision is journaled as a `run.plan_revised` ledger event
carrying its origin, the step it added and the agent config frozen for it. A
review fix is one of these revisions: `review/fix.ts` freezes the selected
comments, their pinned hunks, the current files and the current diff sha into the
step's prompt, and the step waits on the nodes that produced that diff.

## Reviewing a Diff

The reviewer never reconciles a moved anchor, so every surface it builds is
pinned to a `DiffFile.sha`. Reviewed marks are stored per file as the sha they
were given at (`runs/diff/reviewed-files.ts`): a refresh keeps every file whose patch
is byte-identical and only the files a new head really touched come back unread.
`Hide reviewed` filters on that set but never withholds a file carrying an
unresolved comment, and always says how many it is holding back — a reviewer who
cannot see a file must at least know it exists.

Context expansion reads the real thing rather than guessing around the patch:
`GET /api/runs/:id/diff/file` verifies the caller's sha against the live diff and
answers with the exact base and head blobs, refusing a moved anchor, a binary
file, or one past a byte cap instead of shipping a truncated "full file". The web
card only hands those blobs to `@git-diff-view` while they belong to the sha it
is rendering — the query key carries it — because content paired with a stale or
empty patch is what turns a real diff into a neutral, unchanged-looking file.

A comment pins to `(file_path, line, diff_sha)` where `line` is null for a
whole-file comment. Line comments capture their covering hunk; a whole-file
comment captures none, so a stale anchor falls back to a short, named excerpt
rather than the entire patch. `runs/review/partition.ts` splits comments into the ones
the live diff can place exactly and the ones that can only be shown at a
fallback, and the Comments rail states which is which before the reader clicks.

`review/authority.ts` answers, explicitly, whether Otomat may point an agent at
the branch under review: it must still hold a live worktree for the run, and a
pull request tracking someone else's head ref is read-only however healthy the
local repository looks. The verdict rides on the review detail with the sentence
the cockpit shows, so review-only is explained rather than being a silently
missing button.

## Session Capacity and the Launch Queue

A launch answers as soon as the run and its frozen plan are durable. Claiming a
session slot happens behind that answer: `supervisor/advance.ts:scheduleNextStep`
tracks the work in `state.pending` so shutdown and `settle` still observe it, and
a scheduling failure fails the run through `supervisor/fail-run.ts` — with the
reason written into the run's ledger, since the launcher has already been told the
run exists. A saturated host therefore returns `201` with a `queued` run instead
of holding the request open, and `POST /api/runs` carries the `wait` that explains
it (`concurrency_limit` with the place in line, or `workflow_dependency` naming
the plan nodes still to finish). The same `wait` rides on the run detail, so the
cockpit distinguishes `queued` from `running` rather than showing a spinner.

The bound is each host's own setting, not a client preference: `daemon_settings`
holds `max_concurrent_sessions` (default 4) in that daemon's database, served and
changed through `GET`/`PUT /api/settings/capacity`. `supervisor/semaphore.ts`
resizes live — raising the cap hands the freed slots to the head of the FIFO queue
at once, lowering it never touches a holder and only gates the next start. In the
desktop shell, `remote/host/capacity.ts` relays the read and the write to the host
the operator is configuring; an unreachable host or a refused write comes back as
a message, never as a value shown as applied.

## Frontend Stack Direction

React, Vite, TanStack Router/Query/Form, Tailwind, Base UI (shadcn-style
primitives), lucide-react, sonner, zod, `@git-diff-view/react` for diffs, xterm for
terminal/session surfaces, and zustand only when a local UI store is actually
needed.

Markdown from Linear and from agents renders through `packages/ui`'s `Markdown`
component, which compiles `markdown-to-jsx` into React elements — never
`dangerouslySetInnerHTML`. Three settings carry the policy: raw HTML parsing is
off so untrusted markup stays literal text, frontmatter detection is off so a
body opening on `---` keeps its content, and streaming suppression is off
because it drops the characters of an unclosed `**` instead of showing them.
Every destination, image included, passes the `lib/markdown/href.ts` allowlist
through `MarkdownLink`; an image renders as a link because Linear's uploads need
credentials the cockpit does not send. `lib/markdown/open-fence.ts` is the one
thing a compiler cannot tell us — it sees a finished document — so an unclosed
fence can be labelled as still arriving.

## Offline-First Direction

For V1, the local daemon is the offline cache: it mirrors external state into
SQLite, serves last-known state without network, and streams local updates to the
web app over SSE. The frontend uses TanStack Query + SSE. There is no IndexedDB
replica and no `frontend/store` package.
