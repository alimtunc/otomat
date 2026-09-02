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
      api/             # HTTP routes + SSE handlers (run ledger, activity snapshot) (OTO-9)
      context/         # declarative agent context: freeze a selection, build a session dossier, render it
      events/          # event ledger + stream-to-file tailer (OTO-7)
      git/             # worktree/branch lifecycle + diff      (OTO-8)
      github/          # gh CLI, PR publication, and adoption of a pull request Otomat did not open (OTO-26)
      data-safety/     # startup diagnostics + restore maintenance mode (OTO-29)
      diagnostics/     # correlation-id request log + bounded redacted excerpt   (OTO-52)
      review/          # review slice: scoped diff snapshots, comment anchoring, fix proof, PR-comment publication (OTO-11, OTO-57)
      runtime/         # adapter contract, provider adapters, model + option feature detection (OTO-6)
        probe/         # bounded, credential-free reads of an installed provider binary
        providers/     # one folder per runtime: adapter, frames, models, options
      supervisor/      # process supervisor + pid reconciliation (OTO-10)
        workspaces/    # worktree inventory, attachment, safe cleanup and reconciliation (OTO-88)
      index.ts server.ts bootstrap.ts   # composition root / entrypoint
    tests/             # agents/ api/ data-safety/ events/ git/ runtime/ supervisor/ + support/
  desktop/             # Electron alpha shell: manages the local-daemon lifecycle, serves the web build
    src/
      main/            # app lifecycle, daemon spawn, data layout/recovery, logs, support export
        remote/        # remote execution host: ssh tunnel, daemon start-or-verify, host selection, daemon update journey
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
`supervisor` (OTO-10), `review` (OTO-11) and `github` (OTO-26) live the same way
under `apps/local-daemon/src/<module>`, consumed through
`#supervisor`/`#review`/`#github`.

## Ticket Ownership

| Path                              | Owner                    | Notes                                                                 |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `apps/web`                        | OTO-5, OTO-9, OTO-15     | Vite/React cockpit; file-based routing + domain-split components.     |
| `apps/local-daemon`               | OTO-5, OTO-9/10, OTO-13  | Local process host; backend modules folded in by OTO-13.              |
| `apps/local-daemon/src/runtime`   | OTO-6                    | Push-sink adapter contract and simulated adapter.                     |
| `apps/local-daemon/src/events`    | OTO-7                    | Append-only event store, stream-to-file ingestion, projections.       |
| `apps/local-daemon/src/git`       | OTO-8                    | Worktree/branch ownership, canonical diff, cleanup primitives.        |
| `apps/local-daemon/src/data-safety` | OTO-29                 | Safe startup diagnostics and the one-shot restore maintenance mode.   |
| `apps/local-daemon/src/diagnostics` | OTO-52                 | Correlation ids on `/api`, and the bounded redacted excerpt a host serves. |
| `apps/web/src/components/diagnostics` | OTO-52               | Classified error report: details, host log excerpt, copy/export/report. |
| `packages/domain/src/redaction`   | OTO-29, OTO-52           | The one log redactor; shared by the shell, the daemon and the cockpit. |
| `apps/local-daemon/src/api`       | OTO-9                    | Local daemon routes and SSE surface.                                  |
| `apps/local-daemon/src/context`   | OTO-107                  | Frozen context selection, per-session dossier, and its rendering.     |
| `apps/web/src/components/context` | OTO-107                  | The one prompt composer: attached-context chips plus an optional note.|
| `apps/web/src/components/workflow` | OTO-64                  | The shared node-graph editor, plus the preset library it fills from. |
| `apps/desktop/src/main/data-safety` | OTO-29                 | Versioned data layout, redacted rotating logs, support bundle export. |
| `apps/desktop/scripts`            | OTO-21, OTO-30           | macOS packaging: ad-hoc local build, signed/notarized release, packaged smoke. |
| `apps/desktop/src/main/update`    | OTO-33                   | Self-update of the signed app: feed, installability, safety gate, state machine. |
| `apps/local-daemon/src/supervisor`| OTO-10, OTO-87           | Process supervision, pid reconciliation, and the recovery of a stopped plan. |
| `apps/local-daemon/src/review`    | OTO-11, OTO-26, OTO-57   | Review slice: scoped diff snapshots, comment anchoring, destinations, fix-step context, fix proof; one surface for a run and an adopted pull request.|
| `apps/local-daemon/src/github/import` | OTO-26               | Adoption of an existing pull request: reference, verification, provenance, detection, audit. |
| `apps/web/src/components/pull-requests` | OTO-26             | The issue's pull requests: attached cards, detected candidates, manual import, detach. |
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

Codex's confined Linux choices have a second, credential-free host gate:
`codex sandbox true` must start the installed CLI's real namespace sandbox in
the target cwd. A successful answer is cached by binary identity and cwd; a
failure is not cached, so correcting the host makes the next launch immediately
retryable. A failed probe removes `read-only` and `workspace-write` from the
announced choices while leaving `danger-full-access` reachable only through its
existing explicit dangerous-value confirmation. Launch, append and resume
preflight the frozen config before creating a provider session, PR metadata
generation preflights its read-only invocation, and the adapter repeats the
guard before spawn. Refusals report the redacted effective argv, cwd,
host/environment, CLI version, requested and resolved sandbox, exit/stderr and
the relevant user/network-namespace settings; they never substitute an
unconfined mode.

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

Project skills are discovered one directory deep from `.agents/skills` and
`.claude/skills`. Discovery only makes a skill selectable: an agent profile owns
the selected ids, resolution freezes their content hashes, and `composeTurnPrompt`
prepends the frozen bodies before the supervisor chooses Claude or Codex. The
repo-local `first-pass-quality` skill therefore reaches both runtimes through the
same profile contract without becoming a daemon-built-in role. Its Claude project
path is a symlink to the canonical `.agents` directory; realpath de-duplication
keeps one catalog entry and one instruction body.

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

## Saved Workflow Presets

A preset is a **structure**, not a launch: the steps, their dependencies and
compete groups, the agent each node names, and its one static instruction. It
holds no issue, no repository file, no run data and no secret, so
`workflowPresetPlanSchema` is the launch plan's own graph minus the context a
launch attaches — validated by the same `refinePlanGraph` walk, and savable while
empty because a preset is composed over time and refused at launch instead.
`presetPlanFromDrafts` builds it by dropping `context` from what the launcher
would send, which is what keeps a preset structurally unable to carry a field the
plan does not have.

Presets are daemon rows (`workflow_presets`), not browser state, because they
name profiles and runtimes that belong to the host: a preset composed against a
VPS daemon's profiles is meaningless in another machine's local storage. Scope is
one column plus its owner — `global` with no project, `project` with the project
it belongs to — so `listWorkflowPresets` answers "what is reusable here" as every
global preset plus this project's own, and a name identifies a preset inside its
own scope (a collision is refused, `preset_name_taken`, rather than shadowed).
Duplicating is how a global preset gets adapted locally; the copy is numbered
until the target scope has room for it and the source is never touched. Those
rules live in `api/workflow-preset-writes.ts` and answer with a typed refusal, so
the route only resolves the row and maps a refusal to its status.

Compatibility is resolved per read, never stored: `workflowPresetCompatibility`
runs each node through `resolveAgentConfig` — the same resolution a launch
performs — and reports the refusal it would have raised, so a profile, skill or
runtime that left the host is visible before launch and the preset is not offered.
A node that names no agent is silent there rather than assumed sound: what it
inherits is the launch's own configuration, which only the launch gate can
resolve.

Nothing reads a preset after a launch. Applying one fills the launcher's draft
and stops; `runs.plan_json` is frozen from that draft with the issue attached, so
editing or deleting a preset cannot reach a past or active run. The composition
surface is therefore shared rather than duplicated:
`apps/web/src/components/workflow` owns the node graph editor, parameterised on
what a node may attach — a launch passes its issue and project, a preset passes
`null` and composes its static note alone. The editor carries the graph in its
own `usePlanDraft` form, so each node name is a real field wherever it is
composed, and the surface around it keeps its own form for its own fields.

## Run Steering and Deferred Messages

A user message is a durable intention attached to one **step**, never to the run
at large. The composer posts the selected step, its current participant session
and the hash of the resolved configuration it shows. The daemon validates all
three together, then freezes `target_agent_session_id` and the full
`target_config_json` on the contribution. Later activity cannot redirect it;
`agent_session_id` separately records the turn that eventually carried it. Its
lifecycle is `queued → delivered → acknowledged`, with `failed` and `canceled`
as the other landings. `delivered` requires persisted evidence that a turn
carrying the message was launched, and `acknowledged` requires that turn to have
finished — neither is ever reached from a UI click.

Delivery has one mechanism. `supervisor/lifecycle.ts` claims one FIFO-homogeneous
batch for the target step, session and configuration inside `spawnTurn`, after
the start gate is cleared and before the provider is spawned, and composes the
effective prompt with `withCarriedContributions`. A message sent before a step
starts freezes a null session and rides that step's first turn. A message for an
existing participant either reaches its live channel at the next safe boundary
or creates a new session row linked through `resumed_from_session_id`; it is
never handed to whichever provider session happened to become latest. A
per-step `turn_index` gives those rows a stable order even when SQLite assigns
several of them the same second-granularity timestamp.
`contribution/deliver.ts` adds only the case where the queue is the entire reason
to spawn. If the frozen participant becomes unavailable, the contribution lands
`failed` with the exact reason and its body remains visible and retriable.

Because the claim is the unit of delivery, restart recovery is a question about
one turn: `contribution/reconcile.ts` promotes a crash-time claim to `delivered`
only when that turn's own start gate was consumed, and returns it to the queue
otherwise. That is what makes a replay idempotent — a message is never delivered
twice, and never buried as delivered by a worker that never ran.

The run ledger remains the canonical event sequence, but conversation history is
read through `/api/runs/:id/steps/:stepId/events/window`. The cockpit keeps the
selected step in the route search, filters the live SSE tail to that same step,
and renders the ordered step list as run progress rather than as one synthetic
run-wide conversation. Refresh, deep links and the issue-embedded conversation
therefore reopen the same participant without browser-only state.

A model revision is also turn-scoped. `RuntimeCapabilities.resume_model` is a
feature-detected answer from the installed Claude or Codex binary; an unsupported
runtime carries its own reason and the UI offers an appended follow-up step
instead. A supported selection clones the participant's frozen configuration,
validates the model-scoped options, records `session.model_override`, and stores
the result as `step_runs.next_turn_config_json`. The active session is untouched.
The first queued contribution freezes that pending hash, and the spawned resume
turn persists the requested configuration and any provider-reported model on its
own session row before clearing only the pending value it consumed.

`RuntimeCapabilities.steering` is a guarantee level (`live`, `turn_boundary` or
`unsupported`), not a boolean. A model override never upgrades that guarantee:
the active turn continues unchanged, and the pending configuration is consumed
only by a later native resume — an explicit **Resume** applies it the same way a
queued message does, or refuses when the runtime no longer announces
resume-with-model. A runtime that cannot steer or resume is refused at the
composer instead of queueing forever.

**Stop step** (`supervisor/stop-step.ts`) interrupts one live turn without
closing anything: the process group is killed with no grace on purpose, so no
terminal marker lands and the existing settle classifies the turn `interrupted`
— the same resumable landing a daemon crash produces, honored against a final
marker the worker already wrote. The step's queued messages are then held
in-memory until an explicit message, retry or resume, because an automatic
delivery would relaunch the very turn the operator just stopped; a restart
clears the hold but nothing auto-delivers on boot, so the queue still waits for
an explicit action.

## Runtime Interactions

An agent that blocks mid-turn on a permission, a choice or a written question is
answered through one provider-agnostic contract. `supervisor/interaction/` owns
that lifecycle end to end; the conversation, the Activity Center and the project
badge only consume it.

The request travels on evidence the turn already writes. An adapter translates
its native protocol into a `runtime.interaction_requested` event, the session
tailer ingests it, and a pass paired with that tailer promotes it into a
`run_interactions` row keyed by `(agent_session_id, provider_request_id)`. The
ledger is therefore the request's proof: a pass that runs twice, or after a
restart, reaches the same row instead of a second one. A pending row rests the
run and its step on the already-reachable `awaiting_permission` state, which is
what makes the Activity Center entry, the Inbox kind and the shell badge appear
without a projection of their own.

The answer travels back on the channel that already writes into a running turn's
stdin: `live-input.jsonl` carries a steering message and an interaction answer as
two kinds of the same item, with the same per-item receipts and the same
per-turn reset. The worker's single stdin pump writes a user frame for one and a
provider control frame for the other, and takes the first answer per request id,
so a retried command can never reach the provider twice. The row is marked
answered only behind that write, and the write is scoped to a still-pending row,
so two racing commands settle it once.

A request outlives nothing that cannot receive it. `settleRun` cancels a settled
session's open questions next to the contributions it resolves, so the live exit,
an abort and boot reconciliation all close them; an answer aimed at a session
that is no longer in flight cancels the request and is refused with the reason,
never accepted into the void.

Claude Code reaches this contract through `--permission-prompt-tool stdio`, which
routes an ask the frozen permission mode did not settle to the client as a
`can_use_tool` control request on the stream-json channel Otomat already owns —
no MCP server and no second process. The CLI's `permission_suggestions` are
dropped on purpose: one approval must never widen the mode the run was launched
under, and a refusal the operator gave is reported once rather than again as the
provider-decided denial the result frame echoes. Codex declares the capability
unsupported with its reason: `codex exec` reads stdin as the prompt and has no
approval channel, and the interactive app-server protocol is a different
transport.

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

## Repositories Belong To A Host (OTO-60)

A repository is one project on exactly one execution host, and Settings says which. `HostCatalog`
answers for every configured host in one walk — projects for the switcher, registered repositories
for Settings — by asking each host's own daemon through `@otomat/client`. A host that cannot be
reached reads `null`, never an empty list, so an unreachable VPS renders its ssh reason instead of
looking like a machine with no work on it. Registration and deletion resolve the same way: they run
against the host the operator named, and a refusal — a path that does not exist there, a tunnel that
is down, a run still in flight — comes back as that host's own sentence. Nothing is ever retried
against the local daemon, because a silent local fallback is how a VPS project would quietly become
a second, competing local one. `RepositoryContract` carries `root_path` so a row is legible without
joining the project list; `available` stays a per-read probe of that same root.

The Linear side needs no per-host secret. Every catalogued key is delivered to each host's daemon in
memory (see "Several Linear Workspaces" below); what is per project is the mapping, and it is scoped
by the daemon that owns the project — `GET /api/linear/sources?projectId=…` — so two projects on one
connection keep independent team, Linear-project and lifecycle-state selections and neither reads
the other's rows. When the vault holds a key the active host has not received yet, the project's
Linear panel says exactly that rather than inviting a connection that already exists.

## Several Linear Workspaces (OTO-145)

The catalogue of connections is global; the choice of one is per project. `linear_connections` holds
what identifies a connection — a label plus the workspace and account it last authenticated as — and
never its key: the daemon keeps keys in a `LinearConnectionRegistry` in memory, one abort controller
each, and the desktop shell keeps them in its `safeStorage` vault as one `{ connectionId: apiKey }`
map. Nothing else on the path may hold one, which is why a key reaches a host only as a
`POST /api/linear/connections` body.

`issue_sources.connection_id` is the single binding. A project's connection is *derived* from its
own mappings rather than stored beside them, so there is one fact to keep true: a second mapping
naming another connection is refused (`linear_connection_mismatch`), and every read that needs a key
— a sync pass, a lifecycle assertion, an issue's write-back — resolves it the same way, through the
project the issue or source belongs to. That is what keeps CRM's issues off Otomat's key when the
operator switches project, and what lets two projects deliberately share one connection.

A connection fails alone. Its own controller means a revoked key retires only its calls, marks only
its row `failed`, and leaves every other project syncing; `GET /api/linear/sync-status` carries the
project's connection so auto-sync fires only against a connected one, while the project surface
reads the catalogue and the delivery snapshot to separate "no connection chosen", "the key never
reached this host", and "Linear refused it". Disconnecting is the one destructive operation, so it is the one
that asks: the cockpit lists the projects that lose their mapping before the daemon drops the
connection, its sources and their cursors. Rolling back a rotation never does that — the vault still
holds the previous key, so a failed vault write re-delivers it instead of deleting anything.

## One Remote Host Journey

Connecting to a remote host and putting the expected daemon on it are one state machine, not two:
installing a build stops and restarts the tunnel, so a second machine would render a normal upgrade
as a lost host. `RemoteHostStatus` carries both halves — the ssh/tunnel phases and
`checking_version → waiting_for_runs → waiting_for_artifact → installing_update → verifying_update`
— and `ExecutionHostManager.remoteStatus` composes them in one place, the update speaking for the
host while it runs. `upgrade/coordinator.ts` drives it from every `connected` transition, so a
client closed mid-wait resumes on its next launch and nothing is scheduled or persisted.

Three rules keep it honest. A run in flight is never interrupted: the coordinator waits, says how
many runs it is holding for, and the cockpit refuses new launches so the queue drains instead of
deferring the update forever. A bundle CI has not published yet is a wait, not a failure: the
availability probe runs before anything is stopped, and a queued or running workflow — or a probe
the host could not answer at all — is re-checked on a bounded backoff until the exact artifact
lands. And a failure — a workflow that failed, a bundle that never came, an install that stopped —
is recorded against the build it left running rather than retried on a timer: the old daemon and its
database are intact, the exact cause rides on the snapshot, and the Settings button is the retry for
a cause the operator has fixed.

The corollary is on the renderer: a 20–30 second bootstrap is progress, so nothing may render it as
a failure. `isRemoteHostSettling` is the one predicate — the shell shows a compact progress line
instead of `Offline`, `QueryBoundary`/`QueryList` hold their pending slot instead of mounting a
generic error, and cached data stays on screen. It covers the phases where the data path is coming
up, never the two waits: they serve the cockpit and last as long as the runs — or CI — do, so
masking query failures through them would hide them for hours. Only a terminal failure reaches
offline: the session's reconnect loop keeps trying past its schedule but stops calling the failure a
hiccup once it is exhausted, so a host that will never come up says why. Full contract in
[`docs/ai/remote-execution-host.md`](remote-execution-host.md).

## Web Previews Per Pull Request

A pull request is testable at a URL, without a DMG. Cloudflare Pages serves that commit's cockpit
build behind Access; the deployment carries one runtime fact beside its assets — `preview.json`,
naming its pull request and its commit — and everything else is derived from it. `apps/web/src/preview`
resolves the session before the app graph is imported, because `api/client` reads its transport when
its own module is evaluated: no daemon routed yet or none answering yet is the **sandbox**, the same
commit answering is **live**, and any other commit is **blocked**. A build mismatch is refused rather
than degraded — the API the cockpit would call is not the one this bundle was compiled against — and
a starting instance is progress, never a failure screen.

The sandbox is not a second client. It is a `fetch` and an `EventSource` handed to the typed client
through `DaemonClientConfig`, so every fixture is validated by the daemon's own zod contracts and an
SSE replay drives the real conversation and timeline. It is dynamically imported, so no desktop
bundle carries it, it answers reads only, and a read it has no fixture for says
`sandbox_unsupported` instead of impersonating a daemon 404.

**Same-origin façade, not a cross-origin daemon endpoint.** Both were considered. A cross-origin
daemon hostname needs four coordinated relaxations for one feature — `credentials: "include"` in the
typed client, `Access-Control-Allow-Credentials` on the daemon, `withCredentials` on `EventSource`,
and a cross-site `CF_Authorization` cookie — and turns an Access refusal into an opaque redirect. The
Pages Function at `apps/web/functions/api/[[path]].ts` proxies `/api/*` to the pull request's daemon
worker instead: the browser sees one Access-protected origin, the upstream `Response` is returned
as-is so SSE streams, and the daemon's loopback protections are **untouched**. The façade first
verifies the request's Access JWT at the origin (`functions/_access.ts`, fail closed while
unconfigured), so it lends its machine credential only to an identity Access actually authenticated.
Nothing of the browser's identity crosses over — no `Origin`, no `Cookie`, no `Host` — and the
worker rewrites `Host` to loopback, so `hostGuard` and `allowedOrigin` keep refusing everything else
with `OTOMAT_ALLOWED_ORIGINS` unset.

**The daemon runs in a Cloudflare container, not on the operator's VPS.** Each pull request owns
one Worker (`otomat-preview-pr-<n>`, deployed by `scripts/preview/instance.mjs` from CI) whose
container image carries that commit's daemon dist; the running instance is **named by the build**,
so a redeploy reaches a fresh container immediately instead of one still draining on the previous
commit, and a mismatched daemon can only ever be refused, never answered. The Worker admits only
the façade's client pair — checked in the worker itself, under Access service-token header names —
and the container's ephemeral disk reseeds its fixture repository and database on every cold start.
The rendered Wrangler config gives the Worker and its container application the same PR identity,
atop the shared prebuilt base image. Teardown independently deletes
the exact Worker, container application, Pages branch deployments and registry images, then reports
all failures together; `inventory` groups those same strict names by PR and live PR state. The
rejected alternative — per-commit instances on the operator's VPS behind a named
tunnel — kept a personal host and an SSH private key inside CI, shared one machine between all
previews and the stable daemon, and left processes to clean by pidfile; the VPS keeps serving the
desktop previews (`instanceDeployment` in `apps/desktop`), which OTO-99 leaves untouched. Setup and
secrets: [`docs/release/web-preview.md`](../release/web-preview.md).

**A preview launches its runs on the simulated runtime.** No provider CLI is installed in the
container, so the image sets `OTOMAT_ENABLE_FAKE_RUNTIME=1` and the daemon lists its built-in
simulated adapter beside the two real ones it cannot find. That is the only opt-in: a normal
install never sees it, and the launcher still prefers any available real runtime — it falls back
to the simulated one only when there is none. The alternative, a second mock backend behind the
cockpit, was rejected: the simulated adapter is a runtime like the others, so a preview run travels
the real supervisor, ledger, SSE, conversation, usage, worktree and diff instead of a parallel
fixture path that proves nothing. What it does not do is contact a model, and it says so in its own
turn, in its worktree file and wherever it can be picked (`SIMULATED_RUNTIME_NOTE`).

A cold container also seeds its cockpit: `scripts/preview/host/seed.mjs` polls `/api/health`, then
drives the daemon's own HTTP API to create four issues — one ready, one done, one reviewing a
settled simulated run, one whose run was aborted — and stops at the first sight of an existing
issue. Seeding through the API rather than through SQL or React fixtures is the point: a preview
shows rows the real contracts produced. The image ships `procps` nowhere, so the supervisor stamps
a worker's identity from `/proc/<pid>/stat` and keeps `ps -o lstart` for hosts without `/proc`;
without that, every preview run failed before its first event.

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

## Quitting the Desktop Shell (OTO-129)

The shell owns the daemon it spawned, so `before-quit` cannot simply let Electron
go: `QuitSequence` (`apps/desktop/src/main/quit.ts`) preventDefaults the quit,
stops the remote hosts and then the local daemon, and only then re-issues it.

The invariant that shape has to respect is that the only quit request an app gets
may be a single SIGTERM — that is exactly what the packaged smokes send. So a
shutdown that fails still releases the request instead of holding it for a retry
that will never come, and a request already released is never blocked a second
time; the shell that cannot stop its daemon says so in `desktop.log` and quits
anyway, leaving the smoke's orphan check to fail loudly rather than the app
hanging silently. Each phase is logged, so a launch that does hang names the
stage it stopped in.

The smokes hold the other half: `terminate` (`scripts/smoke/harness.mjs`) attaches
its exit listener before signalling, refuses to read an already-dead child or an
undelivered signal as one that ignored SIGTERM, and carries that launch's own
output and logs on every failure — plus the parent pid and the surviving process
tree when it really did time out. Every wait it makes is bounded and unref'd: a
harness that lingers after the shutdown it observed, or that hangs on a child
outliving SIGKILL, reads exactly like the defect it exists to catch.

## Replacing the Desktop App (OTO-33)

The shell updates itself through `electron-updater` against GitHub Releases, but every decision
around it is the repository's own, in `apps/desktop/src/main/update`:

- **who may.** `installability.ts` allows the packaged, signed, `stable` build running from
  `/Applications` and nothing else. A preview keeps its own bundle id precisely so it never stands
  in for the stable install, and an ad-hoc build has no signature Squirrel could match; both get
  the releases page instead. `packaged.mjs` asserts the same split on the artifact: only a signed
  build ships `app-update.yml`.
- **which release.** `feed.ts` puts a prerelease version on the prerelease feed and a plain one on
  stable, and only moves forward inside one feed. A release on the other feed is named in the
  snapshot rather than hidden behind "up to date". `release-macos.yml` marks a prerelease version's
  GitHub release prerelease, which is the flag the provider reads.
- **when.** `controller.ts` checks at startup behind a persisted cooldown (`cooldown.ts`),
  downloads by itself once it finds a release, and stops. Replacing the app is always an explicit
  click.
- **whether it is safe.** `gate.ts` walks every configured host — local first — through
  `HostCatalog.targets()`. `observe` reads; an unreadable answer is busy, never idle. The click
  then calls `arm`, which puts each host on `PUT /api/settings/launch-hold` and judges the run
  count that same call answers with: holding and re-reading in one daemon tick is what closes the
  race with a launch started while the operator was reading the notes. Any verdict but `clear`
  releases every hold and keeps the running app.

Daemon-side, the hold is `SupervisorState.launchHoldUntil` — in memory, expiring by itself, so the
client that armed it may be replaced by the very update it armed it for without stranding a remote
daemon. `requireLaunchable` refuses at the three commands that create new agent work (start, resume,
append step) with the `launches_held` launch code, rather than at the spawn choke point, where a
refusal would read as an accepted launch that then died. The provider-quota sweep skips its whole
pass while the hold is up: being refused there would drop the run's schedule instead of retrying
it on the next pass.

The renderer never owns any of it: `useDesktopUpdate` seeds from one read and then follows the main
process's pushes, so a download survives every navigation. It surfaces twice — the Updates card on
the About settings page, and a row in the existing Activity Center, counted on its badge and
rendered outside the activity query's boundary so a host that stops answering cannot hide it.

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
hands the worktree it leaves behind to the guarded cleanup below
(`merge-closure.ts`). An abandon stamps `runs.abandoned_at`
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

## Reconciling and Cleaning Workspaces

A worktree outlives its run, a restart and a merge, so the daemon reads the real
git state rather than trusting its rows. `supervisor/workspaces/` inventories
each repository from `git worktree list --porcelain`, attaches every entry to a
record, and classifies it — and none of that is stored: the state is derived on
every read, which is exactly why a cleanup that failed is still
`cleanup_required` after a daemon restart, with no extra column to keep honest.

Attachment is deliberately narrow. The persisted `worktrees.path` is the primary
evidence. The Otomat layout is accepted only as validated secondary evidence,
when the worktree sits under this host's worktrees root **and** exactly one
unclaimed record carries its branch; a partial or contested match stays
`ambiguous` and anything outside the layout stays `none`. Neither is ever linked
or deleted, which is what keeps a worktree a user created out of the daemon's
reach.

`projectWorkspaceState` is the one interpretation of the observed facts:
`active` while the issue's cycle still holds it, `cleanup_required` once the
cycle closed with the directory still on disk, `stale` for a registration whose
directory is gone, `missing` for a record git no longer registers, `unmanaged`
for anything unattached, and `removed` once nothing is left. A deletion is
offered only when the cycle is closed, no writer is alive, a merged pull request
names that branch and the tree is clean; otherwise the verdict names the blocker,
and every surface shows that same sentence. The merged pull request may be the
run's own or an adopted one whose head is that branch — an outside merge closes a
cycle exactly like one Otomat made.

`reconcileWorkspaces` is the whole sequence and the only one: re-read the pull
requests still open on GitHub (injected as `refreshPullRequests`, so `#supervisor`
never imports `#github`), `git worktree prune`, converge the records that leaves
behind, then delete what every precondition already cleared. Startup, the bounded
background pass (`schedule.ts`, one unref'd interval, never two passes at once)
and `POST /api/workspaces/reconcile` all run it, so a merge made outside Otomat is
noticed without opening a panel and a failed pass is simply retried by the next
one. Removal is `git worktree remove` without `--force`: git's refusal is
reported and the record is left untouched, so nothing uncommitted is ever
discarded. `--force` stays where it belongs — the acquire rollback and the
archive, which own work they just wrote themselves.

`GET /api/workspaces` is a read that prunes and deletes nothing; the two commands
are the reconciliation and one targeted `POST /api/workspaces/:worktreeId/cleanup`
that the settings table, the issue rail and the run cockpit all go through, so a
destructive action has one confirmation and one code path. The host-wide
`auto_delete_workspaces` setting gates the automatic pass alone: turned off, a
merge still closes the issue and the workspace waits in `cleanup_required`.

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
workspace, with the reason and the last step that failed or went stale.

The projection answers for the issue's **last** run, not for the most specific
thing any run ever did: rows are elected on `run_created_at`, then on how much
their state has to say (active work, then an open PR, then a run awaiting review,
then a stopped cycle), then on `run_id`. A row that classifies to nothing still
competes, which is what lets a `completed` run neutralize the failures of the
cycle it replaced; the rank only separates the rows of one run and genuine
timestamp ties, and the id keeps equal or missing timestamps deterministic.
Nothing is stored, so a refresh or a daemon restart reclassifies every issue.

`ISSUE_BOARD_COLUMNS` is that projection plus the source statuses, in board
order, and the two axes never merge: `projectIssuePrimaryState` is the one place
that arbitrates between them, naming the winning axis and, on the execution one,
the run to open. A terminal source status (`ISSUE_TERMINAL_STATES` — the issue
machine's `done` and `canceled`) wins outright, so a `done` issue reads Done on
its page, the board, the lists and the saved views even while a stopped run still
holds its workspace, because closing that workspace is a separate lifecycle
decision. Below it the open cycle wins, since `ready` would hide a cycle there is
still work to do on, and a closed cycle hands the state back, so an old failure
or review never reads as current. That cycle is the one `projectIssueWorkspace`
computes, never a live process or the last message: worktree cleanup only ever
runs at closure, so the two cannot disagree.

No view recomposes those rules. The boards, the lists and the saved views read
the primary state; every surface that names the execution axis on its own — the
rail's `Workspace execution` row, the list's `Execution` column — reads
`projectOpenCycleExecution` rather than the raw contract field, so a closed
cycle stops advertising the run it stopped on. Only the source status a column
hides is a display concern (`lib/issue/divergent-status.ts`). The issue page
keeps both axes legible in its rail (`Issue status`, `Workspace execution`), and
the run history stays readable there and in the conversations without
contaminating the principal state.

## Suspending on a Provider Quota

A quota is not a verdict either. When a provider refuses the work because its
window is exhausted, the turn's own outcome is still `failed` — that is what the
CLI reported — but the run rests on `waiting_for_provider` instead, and the step
it stopped keeps a `provider_wait_json` naming the provider, its verbatim reason,
the reset it proved and the instant a resume is scheduled for.

The evidence path is deliberately narrow. Each adapter recognises its own CLI's
quota shape (`providers/<id>/limits.ts`) and declares what it can really do
through `capabilities.provider_limit`: Claude Code reaches `deadline`, because it
prints the unix second its window reopens next to the limit; Codex stops at
`detects`, because it reports the quota as a turn error and never says when it
reopens. A mapper that recognises one emits a `runtime.provider_limit` event
keeping the raw frame, and reports it on the turn's `RuntimeFinalState`, from
where the worker stamps it onto its terminal marker. Settle reads the **last**
marker (`findProviderLimit`), which is what keeps one agent session's several
turns apart: a limit scanned for as a loose event would let turn 1's quota
explain turn 2's genuine failure. A torn ledger with no marker stays
`interrupted`, since a killed worker cannot vouch for its own ending, and a reset
that has already passed is not proof — the wait then stays actionable rather than
retrying at once. Nothing is ever inferred: an unrecognised failure is a failure.

The schedule is a property of the step that owns it, not a queue: the durable rows
*are* the work list, and driving `waiting_for_provider → running` is the claim
that makes a resume happen exactly once. `resumeDueProviderWaits` is one pass over
the steps whose run is waiting too — a resume takes the workspace, and only a run
at rest has it free — and it resumes through `resolveResumeAction` like any other
resume, so the same run, step, worktree and provider session come back, with the
recovery session as the same fallback. `startMaintenancePasses` drives it on the
daemon that owns the execution host, so a reset that falls while the desktop is
closed is honoured, and one that falls while the daemon is down is honoured when
it boots — late, never lost and never twice. A workspace that closed under a due
wait is refused and journaled (`provider_resume`, `outcome: refused`) and drops
its schedule rather than looping; a live writer simply leaves it for the next pass.

Because `waiting_for_provider` is not a settled step state, a cancel and an
abandon still close it — which is what makes criterion "merge, abandon or cancel
prevents an invalid resume" hold without a second guard. It is in
`RUN_RESUMABLE_STATES` (so **Resume now** works) and out of
`RUN_FOLLOW_UP_STATES`, so a message posted before the deadline is queued and
carried by the resuming turn instead of starting a turn that would hit the same
wall. `projectIssueExecution` gives it its own state and its own board column,
ranked just under live work: a suspended cycle must read as neither Ready nor
Failed.

## A Pass and Its Git Boundary

A **pass** is one `agent_sessions` row — `insertTurn` writes exactly one per
turn, including every resume — and each pass records two git tree objects on that
row: `start_tree_sha`, captured after worktree init and before the provider is
spawned, and `end_tree_sha`, captured when the turn settles. `git diff` between
them is exactly what that pass did, commits and uncommitted work alike, and it
stays true afterwards because a tree object never moves. `finishSettle`
(`supervisor/pass-boundary.ts`) closes the boundary before anything observes the
settle, so review's `addressed` stamp always has a boundary to read; a capture
that fails stores its reason in `boundary_error` rather than throwing at the
turn, because a boundary is evidence, not a precondition.

Persisting the tree shas was chosen over persisting the patch: the trees also
back context expansion, and they cost two object writes instead of a diff in
SQLite. The trade is that git may eventually prune an unreachable tree — so
every surface treats a missing boundary as a named absence, never as an empty
delta.

That boundary is what makes the cockpit's diff scopes possible. `review/scope.ts`
is the single place a scope becomes a snapshot — `branch` (base ref → current
state), `commit` (`commit^` → `commit`, or the empty tree for a root commit),
`step` (its first pass's start tree → its last pass's end tree), `pull_request`
(the published or imported head against its base), and `session` (one pass's two
trees) — so no surface can pair one scope's descriptor with another's content.
Every diff read carries the scope that answered plus an `unavailable` sentence
when none could; the reviewer keeps the scope control on screen in that state
rather than falling back to the branch diff. Blob reads take the same scope, so
expanded context always comes from the trees its patch was taken between.

`branch` is the default because the question the main view answers is a git one:
what does this branch currently carry against the base it will land on. That base
is the pull request's target once one is attached, and the worktree's fork base
otherwise — `review/pull-request.ts:runDiffBaseRef` decides it, and both
`review/scope.ts` and `review/subject.ts` read it, so the diff a reviewer sees and
the diff their comments anchor to are the same `{base, tree}` pair. The scope
descriptor carries the branch and the base ref, and `CanonicalDiff` carries both
ends' shas, so a reader can state what was compared instead of inferring it. The
prompt-context digest keeps the fork base: it answers what the worktree carries,
not what the branch proposes.

The picker offers `branch`, `step`, `commit`, and `pull_request` once the run
has one: those are the slices a reviewer chooses between. A step that captured no
pair of boundaries is listed unselectable rather than hidden, so an absent delta
reads as an absence. `session` stays a scope without being offered, because a fix
proof links to the one pass that produced it, and a step that took several turns
has different per-file shas than any of them.

The branch's fork point is recomputed (`git/diff-inputs.ts`), not read from
`worktrees.base_sha`: rebasing a branch moves where it forks from its base ref,
and the sha recorded at acquire would then make the diff carry everything the
base branch gained since — the shape behind a reviewer counting 407 files against
GitHub's 79. The recorded sha stays the fallback for a base ref git can no longer
resolve, and one `worktreeGitView` serves the diff, the branch commits and the
abandon confirmation so the three cannot drift.

The same boundary is the proof behind an addressed comment. Settle stamps
`review_comments.fixed_by_session_id` with the pass that addressed it, and
`review/fix-proof.ts` narrows that pass's delta to the hunks touching the
comment's anchored lines. The mapping is exact rather than heuristic: a comment's
head-side lines are the *old* side of its fix delta. A pass that changed the file
but not those lines, or did not touch the file at all, is reported as
`no_change`; a lost boundary as `unavailable`. The card keeps the original
comment and anchor above the proof — evidence of a fix does not replace the
context that asked for it.

## Reporting Token Usage

Each `runtime.usage` event is one turn's own totals, emitted on the provider's
result frame, so summing them across a scope is a fact rather than an estimate
(`domain/projections/usage.ts`). `GET /api/runs/:id/usage` reads the **whole**
ledger: the cockpit pages its event window, so summing what the client happens to
have loaded would silently understate a long run. A `runtime.usage` frame
invalidates that read, which is how the total moves while a run works.

Availability is carried, not inferred: `live` for a scope that may still report,
`final` once it has settled with figures, `unavailable` when it settled having
reported none. A field no turn reported stays null and is left out of the line —
never rendered as a zero, which would read as a measured value.

## The Usage Dashboard

`GET /api/usage` answers the whole host's consumption over a rolling window, and
it aggregates where the data is: SQLite groups the window's `runtime.usage` rows
by run, step, UTC day and emitter (`db/repositories/usage.ts`), so the client
receives roll-ups and never a ledger. `SUM` skips the turns that reported nothing
— a metric no turn carried comes back null, not zero — and the matching `COUNT`
is what separates a complete total from a partial one. `json_type` guards every
read, so a text value at a number's path is refused rather than coerced, and a
payload with no readable `usage` object is counted as unreadable instead of being
dropped. The new `runtime_events (type, occurred_at)` index keeps that read off a
full scan; it is deliberately not partial, because SQLite cannot prove a partial
index's predicate from a bound parameter.

Only the period is pushed into SQL. The facets — project, runtime, model, issue,
day — are applied by `usageDashboard()` in the domain, over the period's evidence,
which is what lets the facet options stay read from the whole period: a narrowed
axis is still re-openable. The window itself is resolved from the daemon's clock
and echoed on the response, because a client that computed its own bounds could
not say which instant the totals cover. The run table is a page, and it states
what it left out against the window's own run count.

Host is not a dimension: a daemon answers for its own machine, so the page tags
the host it read rather than offering a filter over one constant value.

## Reviewing a Diff

The reviewer never reconciles a moved anchor, so every surface it builds is
pinned to a `DiffFile.sha`. Reviewed marks are stored per file as the sha they
were given at (`runs/diff/reviewed-files.ts`): a refresh keeps every file whose patch
is byte-identical and only the files a new head really touched come back unread.
`Hide reviewed` filters on that set but never withholds a file carrying an
unresolved comment, and always says how many it is holding back — a reviewer who
cannot see a file must at least know it exists.

Folding follows from that mark rather than living beside it: a reviewed file
opens collapsed, marking one folds it and moves the reader to the next unread
file at its start, and the last mark ends on a stated final state instead of an
arbitrary jump. A manual fold or unfold overrides the derived state only for the
sha it was made against, so the patch change that drops a Reviewed mark also
reopens the file — one fact, `DiffFile.sha`, drives both.

Context expansion reads the real thing rather than guessing around the patch:
`GET /api/runs/:id/diff/file` verifies the caller's sha against the live diff and
answers with the exact base and head blobs, refusing a moved anchor, a binary
file, or one past a byte cap instead of shipping a truncated "full file".
Verification and blobs come from one captured `{base, tree}` snapshot
(`branchDiff`), so the expanded content always matches the patch it is served
with even while the agent keeps writing. The web
card only hands those blobs to `@git-diff-view` while they belong to the sha it
is rendering — the query key carries it — because content paired with a stale or
empty patch is what turns a real diff into a neutral, unchanged-looking file.
The card offers that as one header action rather than a load-then-expand pair,
and the request is latched: folding back to the changes keeps the loaded blobs,
so re-expanding costs nothing and a large file is still only ever read on
demand.

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

Reading a file is one primitive. Every surface that picks a file — the rail in
either mode, the narrow-viewport nav, `j`/`k`, the Comments panel — calls
`revealFile`, which selects, expands, and then scrolls in a layout effect that
rides later renders until the card exists and the selection it asked for has
rendered: a collapsed, hidden or lazily mounted card is reached without a
timeout, and the card is measured in the layout that selection settles — folding
the file just marked reviewed, or dropping it under `Hide reviewed`, lifts every
card below it. `Hide reviewed` keeps the file being read on screen the way it
already keeps a commented one. Selection carries the file in the URL with the
router's scroll restoration switched off (`use-active-file.ts`): it lands after
the reveal, and re-applying the previous file's offset is what left the reader
in the middle of the file they had just finished. The scroll moves the cards'
own container and nothing above it (`runs/diff/scroll.ts`), because
`scrollIntoView` also scrolls every scrollable ancestor — the shell's content
pane included, which is what slid the toolbar off a file's sticky header. A
comment being typed keeps the focus; revealing is a scroll, not a takeover.

Opening a mirrored pull request hydrates itself. `GET /api/pull-requests/:id`
answers one review context — the mirror plus its resolved issue — so the header,
the rail and the diff read a single query, and arriving fires one silent
reconciliation against GitHub (`api/prs/use-reconciliation.ts`) instead of
waiting for a click, head fetch included. Whatever the cache holds stays on
screen while that pass runs; a failure becomes the discreet stale notice carrying
the daemon's own refusal, never a blank view. The operator's Refresh shares that
mutation key, so recovery and arrival can never reconcile twice at once, and each
answer is keyed by the pull request the daemon named — a late one for another
pull request lands in its own entry.

`review/authority.ts` answers, explicitly, whether Otomat may point an agent at
the branch under review: it must still hold a live worktree for the run, and a
pull request tracking someone else's head ref is read-only however healthy the
local repository looks. The verdict rides on the review detail with the sentence
the cockpit shows, so review-only is explained rather than being a silently
missing button.

## Adopting a Pull Request Otomat Did Not Open

`pull_requests` stays the single mirror of a GitHub pull request; `origin`
separates the ones Otomat opened from the ones it adopted. An adopted row has no
`run_id` — nothing here produced it — and hangs off `issue_id` instead, so a
second table would only have duplicated lifecycle, publication and closure.

Nothing is adopted on a resemblance. `github/import/` parses the operator's
reference, refuses a repository that is not this issue's, reads the pull request
with `gh`, and stores what GitHub answered as `attachment_evidence` next to who
attached it and when; detaching stamps `detached_at` and keeps the row, because
the audit has to answer what was attached and on what.

Detection adds a second verification, because GitHub's search answers on tokens:
unquoted, `OTO-119` splits into `OTO` and `119` and matches a pull request
carrying neither as a value. The search is a quoted phrase scoped to title and
body, and every result is then re-read locally by
`projections/pull-request-reference.ts` — one bounded, case-insensitive rule over
the title, the body and the head branch (a mirrored row may hold no head ref
yet). That rule is the only thing the issue card and the Reviews inbox share:
neither accepts what the other would reject on the same text, but each keeps its
own reach and its own ambiguity policy. The issue card searches every state and
so sees only what GitHub indexes — title and body; the inbox re-reads the open
pull requests it already mirrors, branch included, and refuses a row naming two
mirrored issues rather than guessing. The inbox weighs the branch only when
title and body name none, so reading it can add a link but never remove one.
Commit messages are not a surface: GitHub does not index them for pull-request
search and no mirror holds them, so weighing them would cost a `gh` call per
pull request on both paths — deferred, not impossible. A candidate names where
it matched; candidates are offered, never adopted, and `import/detect.ts` clears
the confirmation (`workspace_owned`) only for a pull request this issue's own
workspace published, which the issue card is the surface that enforces. An issue
with no tracker identifier says so rather than showing an empty list that reads
as "there is none".

`provenance` is decided from evidence alone (`import/provenance.ts`): ownership
needs a local fact — a publication Otomat made, or a head ref one of the issue's
runs owns. A readable author that is not Otomat's login is `external`; anything
else, including Otomat's own login on a branch no run owns, stays `unknown`.
External and unknown are review-only, and `review/pull-request.ts` phrases the
refusal from that provenance.

Isolation is the fetch, not a checkout: `git/pull-request.ts` fetches the head
and its base into `refs/otomat/pull/<n>/{head,base}` and pins `{base_sha,
head_sha}` on the row. Otomat therefore holds no branch and no worktree it could
push, and the diff, the anchors and the expanded blobs all come from that one
pinned pair. A refresh re-fetches, which is how a moved head re-pins the review.

The review surface itself is shared. `reviews.subject_id` is a run id or a pull
request id, and `review/subject.ts` is the single place the two differ: where the
diff comes from, whether a fix is authorised, which pull request a `pr_review`
comment publishes to, and which run ledger records the review (none, for an
adopted pull request). Comments, anchoring and publication are untouched, and
the API mounts one `review-surface.ts` under both `/api/runs` and
`/api/pull-requests`.

Closure is a projection, never a rewritten state. `isReviewOpen` drops a run
from `reviewing` as soon as the pull request standing against it — its own or the
one its issue adopted — is merged or closed, so the run keeps its status and its
history either way. Only a *merged* pull request
also drives `closeMergedIssue`: through the issue's canonical run when it still
holds one, and on the issue itself when the work never ran here, which is what
lets OTO-67's Linear write-back apply to a merge Otomat only witnessed.

## The Reviews Inbox

Reviews is PR-first: the synced GitHub pull request is the entry, and a run is at
most context on it. Runs resting on a diff are reached from Runs and from their
issue, which is why `GET /api/reviews` answers a pull-request inbox and the
sidebar badge counts pull requests alone.

The mirror carries the inbox. A pass writes the same `pull_requests` row an
adoption would, minus the adoption: `issue_id` is nullable, `attached_at` and
`attachment_evidence` stay null, and `origin` stays `imported`. Mirroring is not
adopting, so nothing a pass writes can read as an operator's decision. The row
gained the facts GitHub answers about a head — `review_decision`, `checks_state`,
`mergeable`, `requested_reviewers`, `provider_updated_at` — and `toPullRequest`
now always asks `gh` for them, so one provider shape feeds detection, refresh and
sync alike.

Which group an entry belongs to is one pure rule
(`projections/review-inbox.ts`) over those stored facts plus the viewer.
The cascade order *is* the priority, so an entry can never appear twice; the
contract's group list is the display order, a separate concern. `null` is a pull
request the viewer has no stake in and the inbox does not show at all — which is
also what takes a merged or closed one out of the groups and out of the badge,
without touching its row. The badge counts the groups the projection marks
actionable, and an entry holds one group, so it counts once.

The viewer is a host fact, not a request-time lookup. A pass resolves the
connected login and the account's team handles once and stores them on
`daemon_settings`, so reading the inbox is a query — no `gh` process, no network
— and a GitHub outage still answers with what the last pass proved. Team handles
are qualified by organization on both sides (`pull-request-facts.ts`), so a slug is
never matched across organizations, and teams GitHub declined to name stay
`teams_known: false` rather than reading as "belongs to no team".

An issue appears under an entry only on durable evidence: the link the row
already carries, or exactly one mirrored issue named by the same bounded rule
detection uses (`projections/pull-request-reference.ts`), so a surface cannot
resolve a reference detection would refuse. Two matching issues are ambiguous and
link neither — an ambiguous match is never written to the row, so the inbox can
suggest nothing it cannot prove.
`github/issue-link.ts` is that rule, and the inbox and the reviewer both read it
(`GitHubService.pullRequestIssue`), so one pull request cannot be linked in one
surface and unlinked in the other. Resolving is display only: it writes nothing,
and the reviewer still passes the row's own `issue_id` — the attachment alone —
as the workspace the AI fix may act on.

## Publishing to a Pull Request

Publishing is a **durable operation the daemon owns**, not a request the browser
drives. `POST /api/runs/:id/pr` resolves the row, the generation agent and the
first phase, then answers `202` with the publication's initial state; the work
itself is queued on the run's in-memory chain and outlives the request, the route
change and the disconnection that follow. A command whose `details` are absent
asks the daemon to write the metadata as the operation's first phase, which is
why **Create PR with AI** is one command rather than a generation the component
chains into a publication — a navigation used to lose the second half of it.

`publication_status` is that operation's whole record: `generating`,
`committing`, `pushing`, `creating`, then `created`, each transition journaled as
`pr.updated`/`pr.created`, so a client follows the phases over the run's SSE
stream instead of polling. The stream therefore stays open for a settled run
while a publication is still active — a pull request outlives the run that
produced it. `projectPullRequestPublicationOperation` turns the row into the
common `OperationContract` — phases, error, `retryable` — that other long
operations (runs, commit pushes, Linear sync, daemon upgrade) can be projected
into without a job table, a scheduler, a lease or a second source of truth.

Nothing is auto-resumed at boot. Every publication a stopped process left on a
phase is stamped `failed` with `github_publication_interrupted` and the phase it
stopped in (`failed_phase`), which the projection reads as `interrupted` and
offers as an explicit Retry. **Retry is the proven idempotent resume**: a
re-commit of a clean worktree writes nothing, a re-push of the same commit is a
no-op, and `ensureProvider` finds the pull request GitHub already holds instead
of opening a second one. Resuming from a phase would have to guess what the
stopped process had done; retrying asks GitHub.

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

A publication names a `CommitSubject` — type, optional scope, imperative summary
— rather than a free title, and the domain schema refuses anything outside the
Conventional Commits vocabulary at the daemon boundary, so no free-form subject
reaches git or GitHub. `publication/details.ts` composes that one object into
both the commit subject and the pull request title, which is why they cannot
drift apart; the issue identifier is appended by Otomat, never asked of the
generator. Otomat reads no convention from the repository's history: inferring
one from squash-merge titles is how a compliant repository ended up publishing
free-form subjects.

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

## The Activity Center

The header's Activity Center is a **projection of what the daemon already owns**,
never a store of its own. `projectActivities` folds one evidence row per run —
the run, its current or halted step, its project and issue, and the publication
row attached to it — into bucketed `ActivityContract`s, and the publication
variant embeds the `OperationContract`
`projectPullRequestPublicationOperation` already produces rather than deriving a
second set of phases. Nothing about an activity exists that a run row, a step row
or a pull request row does not already say, which is why the panel can never
disagree with Runs, Reviews or the PR panel.

Buckets come from the state machines, not from the component: `running` and
`queued` split the work in flight from the work waiting on a slot or a quota,
`attention` holds every state that is asking the operator something (an
awaited permission, human, or winner; a review that is ready; a failed run; a
publication that failed or was interrupted), and `recent` holds what settled.
Only `recent` is bounded — by a time window *and* a count — because unfinished
work is never hidden, while a header must not grow an unbounded history.

`attention` answers what is required *now*, so the evidence outranks the run
status: a closed issue, an abandoned cycle or a run a newer one replaced silences
that arm whatever its run or publication still reads as, and the activity is
dropped rather than moved to `recent` — it never completed. Liveness earns no
exemption, which is what keeps a `Done` issue whose run stopped at `review_ready`
out of both the list and the badge; that issue's `running` work still shows,
because watching it is not an alert, and the cockpit and the logs keep the
history.

`GET /api/activity` answers the whole cross-project snapshot and
`GET /api/activity/stream` pushes it again whenever it changes. The stream
carries **state, not a ledger**, so it has no cursor: a reconnect resumes by
receiving the current snapshot rather than by replaying what it missed, and the
daemon writes a frame only when the projected payload actually differs. It is
opened once above the routes (`__root.tsx`), so navigating, switching project or
opening a modal never interrupts it; the snapshot query it writes into is the
same one the header reads, so a reload rebuilds the panel from the daemon and a
host that stops answering leaves its last activities on screen behind the stale
notice instead of erasing them.

The panel offers only what the domain authorizes. A run that has not settled can
be cancelled, because `POST /api/runs/:id/abort` is exactly that command. A
failed publication is *not* given a generic Retry here: re-issuing it needs the
publication request — mode, subject, body — that only the PR panel holds, so the
activity deep-links there instead of inventing a command. For the same reason
Linear sync and the daemon upgrade are absent: their domains report a boolean
`running` with no durable phase, and a header that showed them would be showing
an estimate.

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

## Settings and Global Agents (OTO-61)

The sidebar carries work only — Issues, Runs, Reviews, Usage, plus the Inbox and
the two quick actions. Everything that configures Otomat or documents it is
reached from the project switcher, which is where the operator already goes to
change what they are working on. `nav-items.ts` therefore holds one workspace
list and a single `SETTINGS_NAV` entry the switcher and the palette share; there
is no second "Configure" rail to keep in sync with the settings surface itself.

Settings splits four ways, and the split is a claim about ownership rather than
a menu order. *Project* is what belongs to the selected project. *Global · <host>*
is what the operator sets once for the daemon currently answering — their agents,
the skills those agents may activate, execution defaults, presets. *All hosts*
spans every configured host or depends on none: repositories, workspaces, the host
list itself, Linear integrations, appearance. *Reference* is what Otomat reports
rather than what the operator decides: the runtimes it detected, the daemon it is
talking to, and the design system.

That is what keeps the daemon's capability catalog from reading as a roster of
agents. Global · Agents is the operator's own profiles — a profile's runtime,
its instructions, the skills it activates — and Reference · Runtimes is the
probe result for each installed adapter. Neither page invents the other's
content: a profile whose runtime is missing says so and links to Runtimes
instead of hiding, and Runtimes never lists a profile.

Availability is always stated against the host currently answering
(`executionHostLabel`), because the skills catalog and the runtime probe are
that daemon's, not the app's. A configured skill that is gone, disabled or
invalid is shown with that reason (`lib/skill-availability.ts`, mirroring the
launch-time refusal in `agents/skills/resolve.ts`) rather than dropped from the
profile — the profile still holds it, and the operator can see why a launch
would be refused before attempting one.

The routes moved with the surfaces: `/settings/agents`, `/settings/agents/<id>`
and `/settings/skills` are canonical, and `/agents`, `/agents/<id>` and `/skills`
redirect to them, filter and profile id included.

## Global Is Global To One Daemon (OTO-149)

There is no cross-daemon synchronisation, and the settings surface says so instead
of leaving "Global" to be read as "everywhere". A daemon is the only writer of its
own rows, so a catalog held by the local daemon and one held by a VPS daemon are
two catalogs: `hostKeys(host)` keys every daemon-backed read, `api/client.ts` resolves
the write target from `activeHost()` at request time, and nothing in the app can move a
row between them. `HostScopeNote` states that once per screen, on exactly the routes
`hostOwnedSettingsRoutes()` names, so the empty states below it only have to name the
host — an empty Local catalog must not read as a VPS catalog that vanished.
`activeHostLabel()` names a host as a noun ("Local", the ssh alias) for the sidebar
group, the note and a refused write; `executionHostLabel()` stays separate because it
names one mid-sentence ("the local host") and the two cannot share a string.

Repositories and Workspaces stay under *All hosts* because they render one visible
group per host rather than a merged list, Integrations because the Linear vault is
shell-owned and `ConnectionDelivery` already reports each host's delivery, and
Appearance and Sandbox because they are the desktop shell's own — a sandbox reset
refuses outright while a remote host is active. A write that cannot leave — the host
stopped answering — comes back as that host's own sentence (`DaemonTransportError` in
`agentConfigRefusalMessage` and `presetRefusalMessage`), because "the daemon" is
ambiguous once there are two.

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

## Project Tabs (OTO-139)

The shell carries one tab per open project above everything else, and a tab is an
**application** tab: the desktop shell never asks macOS for native ones, so the
strip renders the same in the browser, in the packaged app and in a preview.

A tab is identified by the switcher key the project already had — `host:project`
(`project-selection/host-key.ts`) — so two daemons that both name a project
`local-default` cannot share a tab, a route or a badge. Tabs are opt-in and
independent of the selection: only the switcher's per-project pin action opens
one, and merely picking a project never does, so the bar shows the projects the
operator chose to keep at hand — not every project ever visited — and a
single-project cockpit simply never renders it. Activation stays one code path:
`useProjectSwitcher.selectProject` restores the target's remembered view whether
it was reached from the switcher, a tab or a keyboard shortcut, and the store
deduplicates on open (`project-tabs/state.ts`), so uniqueness holds without
reconciliation.

What a tab restores is the last **project-scoped** location it was on, stored as
the router's `href` so the filters, the selection and the panel state that live in
the URL come back with it. `lib/project-navigation.ts` draws that line: Inbox,
Settings and the agent surfaces answer for every project at once and therefore
never become a project's remembered view.

The attention badge is `countOpenInboxEntriesByProject` over each host's Inbox
snapshot — not a second notification path. `useOpenHostInboxes` polls one Inbox
per host that has an open tab (the active host on its own client, the others
through `bridge.executionHost.readInbox`, the same `HostCatalog.call` seam the
workspace inventory uses) and is mounted from the root layout, so the poll
outlives the route remounts of the shell that renders the badge. That has three
consequences worth stating: an entry that resolves clears the badge with the
invalidation the acting mutation already issues, a project on a host the
operator is not looking at is badged from that host's own poll, and everything
the Inbox projection refuses to count (a withdrawn demand, a completed run) can
never inflate it.

Closing a tab is a view operation and nothing else: it drops the tab and its
remembered route while the selection stays where it is — the project outlives
its tab — and touches no run, branch or worktree.

## One Renderer For Every Host (OTO-160)

A host switch used to reload the renderer, which emptied the query cache, tore
down every subscription and repainted the chrome. It no longer does. The
renderer keeps one `QueryClient` for the whole session and separates three
things the reload used to conflate:

- **Which host is focused.** `lib/active-host.ts` holds the switch the renderer
  made, seeded from the bridge at load. `ExecutionHostManager.select` answers
  with the target's origin, the renderer records it, and the one daemon client
  (`api/client.ts`) reads that origin per request — the packaged CSP names both
  daemon origins up front, the tunnel port being reserved at boot, and the main
  process reloads only as a fallback when the served policy cannot name a new
  origin (an alias configured after load).
- **How long loaded data lives.** Every daemon-backed query key starts with the
  host it was read from (`hostKeys(host)`), and hooks obtain the active host's
  keys through `useQueryKeys()`, which is subscribed to the switch: the router
  memoizes its matches, so nothing short of a per-hook subscription re-keys a
  mounted observer without remounting it. Losing the focus removes nothing;
  an unobserved entry lives its `gcTime`, the stored snapshot
  (`api/cache-snapshot.ts`) is one bucket over every host, and a reconnect
  invalidates the `remote` prefix rather than clearing it.
- **What every open project still reports.** The selection is one project per
  host (`project-selection/store.ts`), a cross-host switch lands the selection
  and the navigation only once the target host answered (never optimistically,
  so no view paints one host's data under another's tab), and the tabs' badges
  come from the per-host Inbox polls described above.

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

The view options menu is split along provenance: the generic axes first, then a
Linear section (`view-options/linear-filters.tsx`) — the only source Otomat
imports issues from today, so a second section waits for a second importer rather
than for a registry with one entry. It appears only when the project has Linear
mapped, the `Sources` axis leaves it in play, and it owns an option of its own, so
the menu never offers a filter that can match nothing. The Status axis takes its
icon and colour from `resolveStatus` like every board column, card and badge, and
a wide selection is recapped as two labels and a count with the whole of it on the
row's accessible name: the row states the effective value, never every value.
Nothing sorts on the sync watermark — it describes the mirror, not the work — and
a view stored on it opens on the default sort through the same unknown-member
fallback that guards every other axis.

The Linear refresh is a secondary action and reads as one: an icon button and its
chevron, with the last pass on the button's accessible name and its date added in
the tooltip, instead of a line whose text would move the whole strip. A failure
also lands in an `sr-only` live region, because the automatic pass that finds it
raises no toast.

The runs list has no named views: `lib/run/grouping.ts` gathers each issue's runs
under one header, and its two filters persist per project under
`otomat.runs-view`. A done issue's group is hidden on arrival — a failed run is
not, since the cycle stays resumable. Both filters only hide rows, never touch a
run, and each reports its own casualties (`visibleRunGroups`): a group emptied by
the failed filter counts as the runs it lost, not as an issue hidden. That header
carries identity only — key, title, link, run count. A status there is wrong
either way: the issue's source status contradicts a live run, and its execution
projection only repeats what the run row beneath it already states.

Grouping by status is the primary-state rule (`projectIssuePrimaryState`), so
every state gets a group — including `blocked` and `canceled`, which earlier
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

How much a thread reads must not depend on how tall its surface is, so the
older-page trigger follows the reader rather than its own visibility:
`use-load-older.ts` arms it only once the reader scrolled away from the newest
item, and the explicit control carries a reader whose window never overflows the
viewport. The cockpit and the conversation embedded in an issue therefore open on
the same single window, however much room each of them has.

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

## Anti-Slop Lint Rules (OTO-119)

The [anti-slop](https://github.com/dmmulroy/anti-slop) Oxlint plugin is vendored
at `packages/tooling/oxlint/anti-slop/` (its files are repo-owned and formatted
with oxfmt), registered through `jsPlugins` in `packages/tooling/oxlintrc.base.json`,
and pinned to matching `oxlint`/`@oxlint/plugins` versions. The vendored
directory is lint-ignored from the root `.oxlintrc.json` — a root-level
`ignorePatterns` entry, because oxlint does not honour patterns added in an
extended config for jsPlugin-loaded sources. The upstream Effect rule group was
deleted from the vendored copy: Otomat forbids Effect, so the group could never
gain a consumer.

Adopted at `error`, with zero violations in owned code:
`no-chained-type-assertions`, `no-conditional-empty-object-spread`,
`no-known-value-widening`, `no-object-parameters`, `no-reflect-apply`,
`no-reflect-get`, `no-unknown-returns`, `no-unknown-type-aliases`,
`no-widen-then-assert`, `require-safety-comment-for-type-assertion`.
The migration's idioms: `satisfies` for exhaustive lookup tables, `Map` for
open-keyed or partial lookups, named interfaces over anonymous object types,
`in`/`typeof`/`instanceof` narrowing over casts, and a one-line
`// SAFETY:` invariant on each assertion that must remain.

OTO-128 adds the repo-owned `no-ephemeral-comment-references` rule beside the
vendored rules. It reports tracker and pull-request references inside line, block
and JSDoc comments while leaving durable standards such as ISO-8601 alone. It is
an error with a zero-finding baseline; `scripts/anti-slop.test.mjs` fixes the
intended detection boundary without inventing exceptions.

Discarded, each against a demonstrated repo need — never weakened, baselined or
scoped down instead:

- `no-module-mocking` — the web, desktop and db test suites isolate the typed
  client boundary and Electron's native modules with `vi.mock` by design;
  replacing ~77 test files with injected seams is a test-architecture project
  of its own, not a lint migration.
- `no-runtime-typeof` — plain-`.mjs` operational scripts must validate external
  input with `typeof` (no type system exists there), zod-free zones parse
  boundaries with `typeof`-based guards and coercers, and error introspection
  on unknown catch values has no other spelling. The `allowInTypeGuards`
  option covers none of these.
- `no-unknown-parameters` — `(error: unknown)` rejection handlers state the
  platform contract, the desktop main deliberately types renderer IPC input
  `unknown` because the renderer is untrusted, and schema-free guard/coerce
  parsers take `unknown` by definition.
- `no-unsafe-dictionary-type` — `Record<string, unknown>` is the honest
  contract for raw JSON ingress/egress in zod-free zones, GraphQL variable
  dictionaries, and journal payloads.
- `no-shape-in-symbol-names` — every hit is zod's own vocabulary (raw shape
  objects fed to `z.object`, `.shape` reads) or the literally geometric
  `AvatarShape`; the lazy structural naming the rule targets does not exist
  in this repo.

## First-Pass Quality Gates (OTO-128)

The quality stack has three owners. `AGENTS.md` carries repository conventions;
`.agents/skills/first-pass-quality/SKILL.md` carries the reusable implementation
sequence; Oxlint and `scripts/guardrails.mjs` carry deterministic checks. This
keeps Claude and Codex on the same repository contract without loading specialist
review rubrics on every turn.

`pnpm guard:react` composes two non-overlapping layers. `pnpm lint:react` uses
`.oxlintrc.react.json` as a separate zero-baseline gate.
It activates 15 rules from the React plugin already compiled into the pinned
Oxlint binary: hook order, render purity, render-time state changes, static
component identity, error boundaries, JSX keys/definitions/duplicate props,
legacy mutation/DOM APIs and void-element correctness. It excludes performance
rules, the experimental React Compiler rule, and four otherwise useful rules with
existing violations. `.turkit.yaml → commands.react_review` lets the ticket flow
run it early only when React files changed; the 1–2 s zero-baseline scan also stays
in `pnpm check` so CI cannot depend on an agent having selected the right profile.
`scripts/react-lint.test.mjs` pressure-tests the gate with a failing render-time
state update and its event-handler counterpart.

The second layer pins `react-doctor@0.9.12` and scans only Bugs and Accessibility
diagnostics introduced against `main`, including untracked React files. The
repository's existing `doctor.config.json` remains the owner of reviewed
file-specific exceptions and now also disables Performance, Maintainability,
Security, 13 rules already enforced by the native layer, dead-code analysis,
remote scoring and
supply-chain requests. This makes the gate blocking on every new retained warning
without turning existing findings into a baseline or sending scan data away.
`scripts/react-doctor.test.mjs` verifies both the exclusion contract and a unique
render-time ref mutation diagnostic.

The candidate audit, measured baselines and promotion criteria live in
[`first-pass-quality.md`](first-pass-quality.md). Knip remains the next dead-code
pilot; broad Vercel guidance and heavy architecture/review skills do not enter the
default stack without the evidence recorded there. React Doctor is a pinned code
lint only; its output is not model training or cross-harness evaluation data.
