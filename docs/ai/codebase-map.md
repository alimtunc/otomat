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
      context/         # declarative agent context: freeze a selection, build a session dossier, render it
      events/          # event ledger + stream-to-file tailer (OTO-7)
      git/             # worktree/branch lifecycle + diff      (OTO-8)
      data-safety/     # startup diagnostics + restore maintenance mode (OTO-29)
      diagnostics/     # correlation-id request log + bounded redacted excerpt   (OTO-52)
      review/          # review slice: diff snapshot, comment anchoring, PR-comment publication (OTO-11)
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

Why `api`, `context`, `data-safety`, `diagnostics`, `events`, `git`, `runtime` are **not** packages: each was
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
| `apps/local-daemon/src/context`   | OTO-107                  | Frozen context selection, per-session dossier, and its rendering.     |
| `apps/web/src/components/context` | OTO-107                  | The one prompt composer: attached-context chips plus an optional note.|
| `apps/desktop/src/main/data-safety` | OTO-29                 | Versioned data layout, redacted rotating logs, support bundle export. |
| `apps/desktop/scripts`            | OTO-21, OTO-30           | macOS packaging: ad-hoc local build, signed/notarized release, packaged smoke. |
| `apps/local-daemon/src/supervisor`| OTO-10, OTO-87           | Process supervision, pid reconciliation, and the recovery of a stopped plan. |
| `apps/local-daemon/src/review`    | OTO-11                   | Review slice: server-side diff snapshot, comment anchoring, destinations, fix-step context.|
| `packages/domain/src/patch`       | OTO-11                   | The one unified-diff reader: hunks, range coverage, GitHub anchor refusals. |
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

A published catalog is a contract that moves: Codex 0.147 lists a reasoning level
as `{ effort, description }` where earlier releases listed the bare identifier.
Both shapes parse, into the same normalised level, because either can come from a
CLI a user has installed. What does not degrade is validation — an entry neither
shape explains fails the whole catalog with the parser's own message, since a
skipped entry would silently shorten the list of what a model accepts.

Those descriptors are the single source for three gates: the daemon refuses an
option the installed binary does not announce (`option_unsupported`, in
`agents/options.ts`), `GET /api/runtimes/:id/options` serves them to the cockpit,
and every surface renders from them without any per-provider branch. The
effective options are frozen into the run plan at launch and replayed verbatim on
resume and follow-up.

A descriptor's `default_value` is what Otomat itself puts on the command line
when no level selected a value, which is why the resolution freezes it into the
step alongside the picked values: the plan then records the argv the CLI really
received, not only the part a human chose. An option Otomat sends no argument for
announces no default, however well the provider documents its own — Codex's
reasoning level is the runtime's business, and claiming it as Otomat's would make
the frozen plan lie. `providerOptionDefault` is the one place a default is read,
because a value the CLI marks dangerous must be reachable only by choosing it.

## Autonomy Is The Default, Approvals Are Not

Otomat drives every provider headless, so a mode that stops to ask a human is a
mode that fails. Each adapter therefore defaults to **the most autonomous policy
its installed binary announces and Otomat did not have to weaken**: Claude Code's
`auto`, where the provider's own classifier decides each call, and Codex's
`workspace-write` sandbox. `bypassPermissions` and `danger-full-access` are never
reached this way. Where the autonomous mode is unavailable the descriptor's own
description says which run it degrades and what to do about it, so the fallback
is never silent.

Interactive approvals are a separate question with a separate answer, and both
adapters answer `permissions: false` today. `claude -p` reports the calls its
permission system refused — the result frame carries a structured
`permission_denials` — but exposes no channel to answer one, so the adapter
records each refusal as a `runtime.permission_request` plus the provider's own
`runtime.permission_response`, and never claims Otomat could have approved it.
`codex exec` does not surface an escalation in a machine-readable form at all.
Nothing here is scraped from a terminal: a request/response contract is worth
extending only for an interaction a provider actually exposes.

Because both stay false, a permission mode and an approval channel must be named
separately everywhere — `Permission mode: Auto` alongside
`Interactive approvals: unavailable` is not a contradiction, and the label
`Permissions — unavailable` (which reads as a blanket refusal) is wrong. A
refusal that happens anyway carries `permission_mode_status`, resolved against
the binary on the host that ran the turn, so the cockpit can separate a plan
frozen before the policy, a mode that host never announced, the classifier's own
verdict under the autonomous mode, and a request nothing could answer.

## Declarative Agent Context

A prompt surface composes references, not text. The issue a run works on is
attached by Otomat, further issues and repository files are attached by identity,
and the only thing a user types is one optional note — so the issue's own body is
never copied into an editable field and a user profile stays the single source of
an agent's permanent instructions. Otomat adds no built-in profile, role or
template, and a node's name stays a label: nothing composes it into a directive.

The selection is resolved once and frozen in the plan (`context/freeze.ts`):
attached issues come from the daemon's own mirror and attached files from one
captured tree, so a launch cannot mix two instants of the repository. A file is
read whole or refused by name — a symlink is refused rather than followed off the
worktree, and a binary, an oversized blob or a path that is not
repository-relative is reported instead of approximated.

What the plan cannot freeze is the cycle's own state, because a step may start
hours later. `context/dossier.ts` therefore captures a dated envelope per
*session* — the frozen selection plus workspace/git, the canonical pull request
and plan progress with each dependency's last report — and `spawnTurn` records it
on `agent_sessions.context_json` before the provider starts, so what an agent
received stays auditable and `GET /api/runs/:id/sessions/:id/context` can show it.
A native resume passes through untouched: the provider still holds the
conversation its own dossier was given. A new step, an appended step and a
recovery session each capture a new one.

Every field is read locally. No external id, tracker URL or credential rides
along, and the rendered context says so — an imported Linear issue reaches a
session exactly like a local one, on a laptop or on a VPS daemon.

## One Execution Configuration

Runtime, model and every option a CLI announces are one configuration, resolved
by one hierarchy wherever Otomat creates or resumes a session: **step > launch >
profile > global**, with `provider` as the honest fifth answer when no level
selected anything and Otomat sends no argument at all. `packages/domain/src/execution`
owns that walk, so the launcher's preview and the daemon's freeze cannot drift;
`ResolvedAgentConfig.sources` records which level answered for each value, and
the cockpit reads it back rather than re-deriving it.

Inheritance is scoped to one runtime, because an option key names a flag of the
CLI that announced it — a permission mode is not a sandbox. A plan node that
names its own agent therefore starts from that agent rather than the run's model
and options, and `daemon_settings`' execution defaults apply their model and
options only to the runtime they name. A step may also decline the run's choice
by name (`agent_default`) and take the agent's own instead.

The two ends of the hierarchy are deliberately asymmetric about refusal. A step,
a launch or a profile naming a value the installed binary does not announce is
refused before argv; a host default that does not apply here is dropped, because
it is a preference for every execution rather than a claim about this one. What a
runtime or model that is *absent on this host* gets is a refusal either way —
never a substitution.

`apps/web/src/components/execution` is the single control: one trigger
summarising the whole configuration over submenus that list only detected values,
reused by Settings, agent profiles, Single run, Workflow (run default and per
step), appended steps and the review fix. A launched run is immutable by
construction — its frozen config is what resume and follow-up replay — so the
cockpit shows it read-only with that sentence attached instead of offering a
picker that could not be honoured.

The compact surface itself is not Execution's: `packages/ui`'s `ConfigMenu`
family owns the trigger, the label/value rows, the submenus and the bounded,
scrolling popups, and the Issues filters compose the same shell with their own
multi-selection state. The split follows what varies — a width or scroll
constraint is one fact in the design system, while resolving a runtime and
confirming a dangerous value stays with Execution. It also decides what the
compact form may drop rather than truncate: the effective value is what the row
shows, and its provenance, the full text, and how the installed binary was read
reach the user through the accessible name and the trigger's tooltip. The
cockpit's Execution card answers the same way — the selected step's effective
configuration first, every step and what the runtime reported behind a
disclosure.

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

An issue owns one canonical workspace while its work is unmerged: the run whose
worktree row is still `active`, that has not been abandoned, and that a merge has
not driven to `completed`. `projectIssueWorkspace` reduces the same evidence the
execution projection reads, so the daemon and the cockpit answer "where does this
issue work?" identically. A second launch on that issue is refused with
`issue_workspace_open` before any row is written; new work appends a step instead.

A failure, a cancel, a lost session or a provider quota error therefore does
**not** close the cycle: the branch, the worktree and the diff are still there, so
`failed` and `canceled` are resting states the run machine can leave through
`preparing`, and the step machine requeues any step that stopped without
succeeding. `RUN_SETTLED_STATES`/`isRunSettled` is the "execution has stopped"
predicate everything else reads (`completed_at` is stamped there and cleared when
a resume reopens the row); only `completed` is machine-terminal, because only a
confirmed merge reaches it.

`supervisor/resume-plan.ts` holds the one decision behind both `GET /api/runs/:id`
and `POST /api/runs/:id/resume`, so the cockpit can never announce a mode the
command then declines to take: reopen an interrupted competition, reattach the
provider session (`native`), open a recovery session on the same step and worktree
with the run's durable context (`recovery`, built by `recovery-prompt.ts`), or
start the plan's next node (`next_step`). A recovery session is a new
`agent_sessions` row on the same step — a failed session row cannot be reopened,
and the honest signal that the provider conversation restarted.

Two things close the cycle. A confirmed merge drives the run to `completed` and
releases the worktree (`merge-closure.ts`). An abandon stamps `runs.abandoned_at`
and stops the plan (`supervisor/abandon.ts`) — it deletes no branch, no worktree
and no commit, which is why `GET /api/runs/:id/workspace` serves the branch,
commits, uncommitted files, diff and pull request as an inventory of what stays
reachable rather than a list of what is about to be lost. Abandoning is refused
while a turn is live: cancel first, so a workspace never has two writers.

`runs.plan_json` is frozen at launch and then append-only. `appendPlanStep` copies
every launched node untouched and may only add one whose dependencies already
exist, so the graph stays acyclic and `readyPlanWork`/`settleRun` keep reading the
same shape. Each revision is journaled as a `run.plan_revised` ledger event
carrying its origin, the step it added and the agent config frozen for it. A
review fix is one of these revisions: `review/fix.ts` freezes the selected
comments, their pinned hunks, the current files and the current diff sha into the
step's prompt, and the step waits on the nodes that produced that diff. It is
refused (`workspace_busy`) while a turn is in flight, so the fix step is always
the workspace's next settlement and settle can credit it with the stamped
comments.

## Recovering a Failed Run

A failure is a fact of the history, not a verdict on the plan. A run's canonical
outcome is therefore read from its **effective** steps: `effectiveStepStatuses`
resolves the append-only `replaces` link so a halted step takes the outcome of
the step appended to recover it, and `allStepsSucceeded`/`haltedPlanOutcome` read
through it. Retrying the same step needs no link at all — the step machine walks
it back to `running` and its own row converges — so `replaces` exists only for
the case where the recovery is a new node. An unlinked step that merely succeeds
next to a failure recovers nothing, which is what keeps a required failure from
being masked by unrelated work. `settleTurn` and `settleIdleRun` ask the same two
questions in the same order, so a hot settle and a boot reconciliation land the
run on the same status. Because a stop cancels every unfinished step, an explicit
resume requeues them (`requeueCanceledSteps`) and reopens the *earliest* stopped
step: without that, the reopened step would be the last one the plan could run.

The ledger says the same thing the rows do. A worker's terminal marker only ever
spoke for one turn, so every settle that leaves a run resting appends a
`run.lifecycle` `settled` event carrying the run's canonical status, and a resume
of a settled run appends a `reopened` event naming the step and the state it
recovers from. A `completed` turn can no longer read as the last word on a run
its plan left failed.

`Failed` is then a projected execution state, never a stored issue status:
`projectIssueExecution` reports it while a run that stopped (`failed`, `canceled`
or the `awaiting_human` an interruption leaves) still holds the issue's
workspace, with the reason and the last step that failed or went stale. Active
work, an open pull request and a run awaiting review all outrank it, so a newer
run never hides behind an older failure. `ISSUE_BOARD_COLUMNS` is that projection
plus the source statuses, in board order — `ready` is only ever an issue with no
open cycle to resume, and the source status keeps being shown next to the column
it diverges from.

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
file, or one past a byte cap instead of shipping a truncated "full file".
Verification and blobs come from one captured `{base, tree}` snapshot
(`diffSnapshot`), so the expanded content always matches the patch it is served
with even while the agent keeps writing. The web
card only hands those blobs to `@git-diff-view` while they belong to the sha it
is rendering — the query key carries it — because content paired with a stale or
empty patch is what turns a real diff into a neutral, unchanged-looking file.

A comment pins to `(file_path, side, start_line, line, diff_sha)`, where `line`
is null for a whole-file comment and `start_line` is null for a single line.
Anchored comments capture their covering hunk; a whole-file comment captures
none, so a stale anchor falls back to a short, named excerpt rather than the
entire patch. `runs/review/partition.ts` splits comments into the ones the live
diff can place exactly and the ones that can only be shown at a fallback, and
the Comments rail states which is which before the reader clicks. A file's
sticky header carries the same facts as a count and a named popover, so a
collapsed, unloaded or reviewed file never reads as free of feedback.

Ranges are read through one unified-diff parser, `packages/domain/src/patch`,
because the cockpit has to explain a refusal before it is sent and the daemon
has to enforce it. `reviewRangeRefusal` encodes GitHub's real constraint — a
comment anchors only to lines its diff shows, start and end inside one hunk —
and `suggestionRefusal` adds that a replacement is applied to head lines. A
refused range is explained, never shortened or re-anchored. An agent comment
carries no such constraint beyond a well-formed span, because expanded context
puts unchanged lines on screen and they are legitimate to comment on.

A comment's destination is chosen, never inferred. `agent` stays in Otomat and
is the only thing `Fix selected comments with AI` will consume; `pr_review` is
published to the pull request by an explicit second command
(`review/publication.ts`) and is refused for the AI fix, so neither destination
is ever a side effect of the other. Publication walks
`local → pending → published | failed`, persisting GitHub's own refusal on the
comment so a failure shows as `failed` with its reason and stays retryable
rather than vanishing. The daemon publishes against the pull request's
`published_head_sha`, never a local head GitHub has not seen, and refuses a
comment whose file moved under it since it was written.

The AI fix opens no prompt channel of its own: it appends an ordinary step, so
the operator's global instruction is that step's note and the selected comments
are its frozen context, anchors and structured suggestions included. Each
provenance stays distinct — the note constrains the fix, edits no comment and is
never published to GitHub — and both survive in `runs.plan_json`, readable per
session in the frozen context the step was given.

`review/authority.ts` answers, explicitly, whether Otomat may point an agent at
the branch under review: it must still hold a live worktree for the run, and a
pull request tracking someone else's head ref is read-only however healthy the
local repository looks. The verdict rides on the review detail with the sentence
the cockpit shows, so review-only is explained rather than being a silently
missing button.

## Publishing to a Pull Request

Two different things can be published to a pull request, so they are two
commands. `publish` opens it, or edits title/body/Draft-Ready on one that
exists; `pushCommits` moves commits onto its head branch. Opening one is the
single path that commits the workspace on the user's behalf, which is what they
asked for by opening it; every later push moves commits that already exist.
Neither command triggers the other, and only opening one waits on
`review_ready` — a pull request outlives
the launch state that produced it, so a finished, failed or cancelled run may
still push to its own open pull request as long as the workspace and branch are
real (`publication/workspace.ts` resolves exactly that, and nothing else).

Only a commit can be pushed, so only a commit can stand as evidence of what was
published: `published_head_sha` is the commit Otomat pushed and
`published_diff_sha` is `commitDiff` of that commit against the run's fork
point, never the working tree. That is what makes uncommitted work impossible to
misreport — a push cannot move it, so no push can clear it. `publication/sync.ts`
answers the live question separately, comparing the workspace against
`git ls-remote` on the pull request's head: `in_sync`, `ahead` (with the commits),
`diverged` (with the commits a rewrite would drop), or `unavailable` when the
comparison genuinely could not be made. It fetches the remote head only when the
object store lacks it, which is precisely the case someone else pushed. The
cockpit therefore never says "unpublished changes" without saying whether they
are pushable commits or uncommitted work.

A rewrite has exactly one path. `push` is always a plain fast-forward push, and a
rejected non-fast-forward becomes `github_push_rejected` rather than a retry with
force. The lease is a separate, explicit request carrying `expected_remote_sha` —
the head the user was shown — which is re-read and matched before
`--force-with-lease=refs/heads/<head>:<sha>` runs, so a branch that moved in
between fails the lease with nothing overwritten. `publication/push.ts` refuses
the rewrite outright for a base or default branch, a branch GitHub reports
protected (an unreadable answer counts as protected), a merged or closed pull
request, and a head the pull request no longer ships. A push failure records its
code on the row without unwinding `publication_status`: the pull request was
created and still is.

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

## Back Navigation

Every detail view carries one Back control, rendered by `RouteShell` from the
`useBackNavigation` result the view hands it. There is no navigation stack of our
own: when the router already holds an in-app entry the control is the browser's
own `history.back()`, so the reviewer lands on the screen they actually came from
with its URL — and therefore its filters, its selection and its tab — intact.

A view opened cold has no such entry, so it falls back to the hierarchical parent
`lib/back-target.ts` names: a run tab to its run, a run to the issue it works on
(the runs list while that issue is unknown), and every entity to its list. That
navigation *replaces* the deep-linked entry rather than pushing over it, for two
reasons: a pushed parent would make the next Back return to the view just left,
and once the hierarchy runs out there would be nothing behind the list but
whatever preceded Otomat. The diff reviewer's `esc` is the same control, so
leaving a review by keyboard and by button agree.

The corollary is that view state a reviewer would resent losing lives in the URL,
not in component state: the issues list keeps its layout, pills and popover
filters there, the issue workspace keeps the conversation it follows, the cockpit
keeps its tab and the reviewer keeps its file anchor. Every such write replaces
the current entry (`runs/diff/use-active-file.ts` states it for the anchor), so
refining a screen never buries the screen it was reached from.

## Saved Issue Views

An operator's issue views are named configurations — layout, grouping, sort,
filters, folded groups — kept per project on the machine that made them
(`lib/issue/saved-view.ts` for the model, `lib/issue/view-storage.ts` over the
per-project buckets of `lib/storage.ts`, which the runs list uses for its own
filters). Nothing is synced to a tracker.

Two rules keep the tabs honest. `All issues` is held apart from the saved list
(`ViewSet.system`), so it can be neither renamed, reordered, deleted nor
overwritten: whatever a saved view filters away, one tab still shows everything.
And the URL carries the *divergence* from the active view, never the whole
configuration — a clean tab stays on `/issues?view=…`, and any field present is
one the operator changed since. That is what makes "unsaved changes" observable
(`hasOverrides`), Reset a navigation rather than a mutation, and a shared link
reproducible: an emptied axis travels as `[]` or `all`, which is why absence can
mean "as the view saved it" without hiding a cleared filter.

A view id the reader does not have resolves to `All issues` with the overrides
still applied, and a filter value the project no longer carries is named in the
toolbar (`lib/issue/invalid-filters.ts`) rather than silently emptying the list.

The runs list has no named views: `lib/run/grouping.ts` gathers each issue's runs
under one header, and its two filters persist per project under
`otomat.runs-view`. A done issue's group is hidden on arrival — a failed run is
not, since the cycle stays resumable. Both filters only hide rows, never touch a
run, and each reports its own casualties (`visibleRunGroups`): a group emptied by
the failed filter counts as the runs it lost, not as an issue hidden.

Grouping by status is the board's own column rule (`lib/issue/board-column.ts`),
so every state gets a group — including `blocked` and `canceled`, which earlier
board columns dropped, leaving those issues on no board at all.

Both list tables are TanStack Table instances over one shared feature registry
(`lib/table.ts`), whose `columnMeta` carries the head and cell classes: a column
owns its width and its rendering in one definition, `components/table/` renders
any of them, and each column list stays pure data (`list/columns.ts`) against one
component per cell under `list/cells/`. Grouping stays the domain's job rather
than the table's: an issue with several labels belongs to several groups at once,
which a row model keyed on one grouping value cannot express. So each table feeds
the flat concatenation of its groups as `data`, and `rowSlices` hands every group
section the rows its own group contributed.

## Reading a Run's Ledger

The ledger is append-only and can be enormous, so a cockpit reads it as a window,
never whole: `GET /api/runs/:id/events/window` serves one page and the cursor to
the page above it. `seq` is allocated at persistence time and never rewritten,
which is what makes that cursor stable — a page already read cannot gain, lose or
reorder a row while the run keeps emitting.

The cockpit composes that page with the live stream instead of choosing between
them. `use-event-history.ts` pages backwards through the window endpoint, and
`RunEventsProvider` opens the SSE stream at the newest loaded `seq`, so the stream
carries only what happened after the first page — a long run is usable without
replaying its history. Pages are keyed outside the `run` query root and never
invalidated, because an immutable page refetched on a run-level event would slide
its own boundary and open a gap between it and the page below.

The conversation reads the same window: `buildConversation` is told whether older
pages exist, since a message a turn already carried is history once its anchor
scrolls above the loaded events, and must not be replayed at the end of the
thread. A message still waiting for a turn stays at the tail either way — that is
where the reader just sent it. The thread holds its distance to the bottom across
a prepend (`use-thread-autoscroll.ts`), so loading history never moves the reader.

## Frontend Stack Direction

React, Vite, TanStack Router/Query/Form, Tailwind, Base UI (shadcn-style
primitives), lucide-react, sonner, zod, `@git-diff-view/react` for diffs, xterm for
terminal/session surfaces, and zustand only when a local UI store is actually
needed.

Every `@otomat/*` import in `apps/web` resolves to the package's `dist`, so a
suite run against a stale build tests a surface that no longer exists — and says
so as `undefined is not a function` at the call site, far from its cause. The web
suite's global setup therefore compares each consumed package's source barrel
with its emitted one first and names the missing symbols.

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

## Command Palette Search

The palette searches one scope: the issues TanStack Query already holds for the
selected project, the same cache the Issues view renders. `lib/issue/search.ts`
matches an identifier, a title and a body case-insensitively, in that order, so
an issue visible in the list is reachable by what the list shows. Cross-project
listing is gone; the heading names the project (and the SSH alias on a remote
host) so a scope is never implied.

`CommandPalette` therefore runs with cmdk's `shouldFilter` off and a controlled
search value: cmdk's fuzzy score cannot see a body, and force-mounting
externally-filtered items would leave them out of its `filtered.count` and
contradict the group's own empty state. One filter owns matching, so the palette
renders exactly what it is given and each group carries its own `notice` —
loading, stale-with-Retry, "no loaded issue matches", or a capped-result count.
Results survive a failed refresh because the notice, not the result list, tells
the truth about freshness.

## Offline-First Direction

For V1, the local daemon is the offline cache: it mirrors external state into
SQLite, serves last-known state without network, and streams local updates to the
web app over SSE. The frontend uses TanStack Query + SSE. There is no IndexedDB
replica and no `frontend/store` package.
