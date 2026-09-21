# Otomat conversations inbox — 2026-09-19 (OTO-214)

A design recommendation for an inbox of execution conversations: the per-step
threads several runs already hold, projected into one list the operator can
scan, filter and answer from. Planning evidence, not a product contract:
validate against the live product before implementing, and keep the invariants
in the ticket. Base: `main` at `5b41aacb`.

Contents: [journeys and confusions](#1--current-journeys-and-observed-confusions) ·
[variants and recommendation](#2--variants-and-recommendation) ·
[V1 anatomy](#3--v1-anatomy) · [state model](#4--state-model) ·
[patterns compared](#5--messaging-patterns-compared) ·
[dependencies and limits](#6--dependencies-and-limits) ·
[prototype](#7--prototype) · [implementation plan](#8--implementation-plan).

## 1 — Current journeys and observed confusions

Every conversation already exists and is durable: a `step_runs` row owns its
`agent_sessions`, `run_contributions` (operator messages), `run_interactions`
(permissions and questions) and the `runtime_events` ledger filtered by
`step_run_id`. Four surfaces read them today.

| Surface | Scope | What it answers | How a thread is reached |
| --- | --- | --- | --- |
| Run cockpit `/runs/:run?step=` | one run | the selected step's thread, composer bound to that step | Steps pane; `selectedStepRunId` falls back to the step with the *last ledger event*, then the first step |
| Issue workspace `/issues/:issue?run=&step=` | one issue | same threads, embedded | `resolveFollowedRun` picks the selected run, else the *oldest* active run, else the latest |
| Inbox `/inbox` | every project on the host | demands: failed, awaiting answer/selection/permission, quota, review ready, PR blocked | one entry per **run**, links to the run (no step) |
| Activity Center (header) | every project on the host | running / queued / attention / recent **runs** and publications | links to the run |

Confusions the code makes possible, each reproduced while reading the flows:

1. **Returning opens the wrong thread.** Without `?step=`, the cockpit follows
   the step with the newest ledger event — a tool call or a log on the
   implementation step outranks the review step whose *answer* the operator
   came back for. The issue workspace follows the oldest active run, not the one
   that just spoke.
2. **"New since I looked" exists only inside one cockpit.** `useStepActivity`
   keeps a per-step seen `seq` in a `useRef`: it is per mount, lost on refresh,
   route change and project switch, and never crosses runs.
3. **A reply is not a demand.** The Inbox and the Activity Center project run
   states. An agent that answers a steering message and keeps `running` changes
   nothing they show; the operator learns of the answer only by opening the
   thread. The first visible signal is often `review_ready`, minutes later.
4. **One row per run hides the thread.** Inbox entries are `run:<id>` and link to
   `/runs/:id` — the cockpit's fallback then chooses the step. A permission on
   step 3 of a 4-step plan is one click plus one guess away.
5. **Hosts are silos.** Runs is one project on one host; the Inbox badge does
   aggregate open-tab hosts (`useOpenHostInboxes`), but no list of threads does.

What is already right and must stay: the composer posts `step_run_id` +
participant session + config hash and the daemon freezes them
(`contributeToRun`), so a message can never drift to "the latest resumable
session"; the step thread reads one bounded window
(`/runs/:id/steps/:stepId/events/window`) plus the run's SSE tail filtered by
step; the Inbox's marks are a projection-side `inbox_marks` table keyed by the
projected entry id with a stale-mark rule.

## 2 — Variants and recommendation

Three placements were drawn, all over the same projection and the same row.

| | A · Conversations tab in Runs | B · Dedicated `/conversations` view (recommended) | C · Conversation entries in the Inbox |
| --- | --- | --- | --- |
| Scope | selected project on the active host | every project on the active host (Inbox rule), project filter | every project on the active host |
| Layout | list only; a row opens the cockpit | master–detail: list left, the step thread and composer right | list only; a row opens the cockpit |
| Unread | new per-step marks | new per-step marks | new `conversation_reply` kind |
| Wins when | the operator works one project at a time | the operator hops between issues (and, from V1.1, hosts) and wants to *answer* without leaving | nothing new should be learned |
| Costs | cross-project loss is the ticket's problem; Runs' toolbar already carries grouping/filters; a row still lands in the cockpit's fallback | one more route and one thread pane composition (~60 lines reusing cockpit components) | mixes "an agent replied" with "a PR is blocked": the Inbox becomes noisy, bulk-archive semantics collide with auto-read, and the row still links to a run, not a step |

**Recommendation: B.** A dedicated `/conversations` view, cross-project on the
active host, master–detail. It is reached from the sidebar (next to Inbox, with
its own unread badge) and from a Runs toolbar link, so both entry points in the
ticket exist without splitting the surface. The Inbox stays the demand list,
the Activity Center stays the operations panel; Conversations is the only
surface where the operator *reads and answers*.

Answers to the product questions:

| Question | Decision | Why |
| --- | --- | --- |
| Default scope | active host, all projects; filter by project, state, unread | the projection is one daemon's; matches Inbox; a host switch is already one click through project tabs |
| Sidebar grouped vs flat | **flat, sorted by last activity**, sections *Active* then *Recently finished*; group-by-issue is a later toggle | the first question is "what moved last" — grouping hides cross-issue recency. Unread is a filter, never a re-sort: a list that reorders under a click is disorienting |
| Row information | unread dot · `OTO-214` · step name · state chip · host · one-line "last message" · relative time; second line: runtime · model · activity verb | enough to choose; runtime/model stay muted because they rarely decide the click; the thread header (`ConversationHeader`) carries the full configuration |
| "Unread" | see §4: a persisted mark stamped with the thread's `updated_at`; opening the thread while the document is visible marks it read; explicit mark-unread and archive | identical rule to the Inbox, so refresh and replay are harmless and a thread that speaks again returns as unread |
| Keyboard / deep links / back | `↑` `↓` move, `Enter` opens, `u` toggles unread, `e` archives, `Esc` returns to the list on narrow viewports; `/conversations?run=&step=` is the deep link; Back is `useBackNavigation` (history when in-app, else the list); the thread offers *Open run* and *Open issue* with `?step=` | `c` and `⌘K` are taken; single-letter verbs mirror Linear/Gmail; URL-held selection follows the repo's back rule |
| Active / finished / pending / queued | one row kind, five readings (§4 matrix) | the durable rows already distinguish them; the view must not invent a state of its own |

## 3 — V1 anatomy

```
┌ Conversations ───────────────────────────── [All ▾] [Unread] [Project ▾] ┐
│ ACTIVE                                       │ OTO-214 · Plan + Implement  │
│ ● OTO-201 Review          awaiting_perm  vps │ [running] Claude Code · opus │
│   Permission: Bash(pnpm check)          2m   │ · effort high · Local        │
│ ● OTO-214 Plan + Implement    running  Local │ ─────────────────────────────│
│   "The recommendation is B…"             4m   │  (StepConversationThread)    │
│   OTO-209 Implement          running    vps  │                              │
│   Working · 3 tools · 1 reasoning       11m   │                              │
│ RECENTLY FINISHED                            │ To: Plan + Implement ·       │
│   OTO-203 Review            succeeded  Local │ Claude Code · opus  [Send]   │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

- **List** — `RouteShell` with `SidePanel` (left, resizable like the cockpit's
  Steps pane) and the thread as the main panel; narrow viewports stack them
  (list, then thread with `Esc`/Back). Rows are `ConversationRow`
  (`LiveDot`, `StepStatusChip`, `Chip` for host, `RelativeTime`); the second
  line ends with the muted runtime · model.
- **Sections** — *Active* (step not settled, or unread) and *Recently
  finished* (settled and read, within the same 24 h window the Inbox uses).
  Both sorted by `updated_at` desc. Archived rows are hidden until they speak
  again.
- **Filters** — state (all / active / waiting on you / finished), unread only,
  project. Component state like the Inbox's filters; never in the URL, which
  holds only the selection.
- **Thread pane** — `RunEventsProvider(runId)` → `PaneHeader` + existing
  `ConversationHeader` (state chip, agent, runtime, model, effort, stop/cancel,
  session details) + `StepConversationThread` (thread, interaction cards,
  composer). The composer's *To:* line is the step name and participant, as
  today. Nothing is re-implemented.
- **Badge** — sidebar *Conversations* item counts unread, unarchived threads
  (`countUnreadConversations`), separate from the Inbox badge.
- **Empty and stale states** — no threads: "No conversations yet — launch a run
  from an issue"; host unreachable: the retained list behind the
  `QueryBoundary` stale notice, rows unchanged, marks refused with the host's
  own sentence.

## 4 — State model

### Entry

One entry per `step_runs` row that has at least one session or one
contribution and whose run is inside the activity evidence scope
(`listActivityEvidence`: unsettled runs, open failed runs, runs updated within
the window). Ids are `conversation:<step_run_id>`.

```
ConversationEntry {
  id, host, project {id,name}, issue {id, identifier, title},
  run_id, run_status, step_run_id, step_name, step_status,
  participant { runtime, agent_label, model, effort } | null,
  last: { kind: "agent" | "user" | "interaction" | "lifecycle", text, at },
  pending_interaction: { kind, prompt } | null,
  queued_contributions: number,
  updated_at,            // the thread's last *activity*, not the row's updated_at
  read, archived         // from the mark, after the stale rule
}
```

### What moves `updated_at` (and nothing else does)

| Evidence | Moves the thread | Reason |
| --- | --- | --- |
| `runtime.message` with `thinking !== true` | yes — `occurred_at` | an answer the operator waits for |
| `runtime.message` thinking, `runtime.tool_call`, `runtime.log`, `runtime.usage`, `git.diff_updated` | no | technical events; they feed the "activity verb" only |
| stream deltas | n/a — the ledger has none: the Claude adapter emits one `runtime.message` per completed content block, Codex per item | the counter cannot tick per chunk |
| step transition into `awaiting_permission`, `awaiting_human`, `waiting_for_provider`, `failed`, `stale`, `succeeded` | yes — step `updated_at` | actionable, or an outcome to read |
| step transition into `starting`, `running`, `queued`, `canceled`, `withdrawn` | no | nothing to read; cancel and withdraw are the operator's own act |
| `run_interactions` row pending | yes — `requested_at` | a question is a message |
| `run_contributions` queued by the operator | no (the row's own `last` becomes the message; the thread was open) | one's own message is not news; it becomes news when it settles `failed` |
| `run_contributions` → `failed` | yes — `settled_at` | undeliverable message needs a decision |

The unread count is `count(entries where !read && !archived)`. A thread with
five new messages counts once.

### Marks

Reuse `inbox_marks` and `POST /api/inbox/marks` unchanged: the table is keyed by
a projected entry id and the schema (`entry_id`, `read`, `archived`,
`evidence_updated_at`) is what a conversation needs. `projectInbox` looks marks
up by its own ids and cannot see a `conversation:` mark; `projectConversations`
filters the prefix. The stale rule is the same one line: a mark whose
`evidence_updated_at` is older than the thread's `updated_at` reads as unread
and unarchived. Rejected: a `conversation_marks` table and route — a migration,
a mutation and a second optimistic cache for the same three fields.

Auto-read: the view posts `{read: true, evidence_updated_at: entry.updated_at}`
for the selected thread when (a) it becomes selected, and (b) its `updated_at`
advances while it stays selected **and** `document.visibilityState === "visible"`.
A thread open in a background tab stays unread. Marking never touches a run, a
step, a contribution or an interaction — the route reaches no service seam.

### Scenarios

| Case | Behaviour |
| --- | --- |
| **Stream** — an agent turn emits 40 tool calls and 3 text blocks | the row's activity verb updates on each SSE snapshot; `updated_at` moves 3 times; the thread flips unread once (if not selected); the badge changes at most once |
| **Reconnection** — the conversations stream drops | it is a state stream (no cursor, like `/api/activity/stream`): on reconnect the client receives the current snapshot; marks are server-side, so nothing is double-counted or lost |
| **VPS disconnected** | the per-host query keeps its last snapshot; rows render behind the stale notice; selecting a row still opens the retained thread window; the composer and marks refuse with the transport error (`DaemonTransportError`) until the host answers |
| **Refresh** | `?run=&step=` restores the selection; marks come from the daemon; the list is re-read; the selected thread is auto-read only if the document is visible |
| **Deep link** (notification, PR comment, pasted URL) | `/conversations?run=&step=` selects that thread; an unknown or foreign-host step shows "not on this host" with a link to the run; Back falls to `/conversations` |
| **Terminal conversation** — step `succeeded`, run `completed` | row moves to *Recently finished* once read; the thread still renders; the composer is blocked with the existing note (`resolveContributionGate` → "This step is finished… Add a follow-up step") and offers *Open run* to append one |
| **Pending permission or question** | `pending_interaction` fills the row's line ("Permission: Bash(pnpm test)" / "Question: …"), the chip is `awaiting_permission`/`awaiting_human`; the interaction card and its answer form render in the thread; answering advances the step through the existing command |
| **Queued contribution** | the row line reads "1 message queued · delivers on the next turn"; the thread shows the existing queued banner; `failed` makes the thread unread again |
| **Compete group awaiting selection** | each candidate step is its own row; the thread pane shows the candidate's conversation; picking the winner stays in the cockpit (*Open run*) |
| **Archived thread speaks again** | the mark is stale → unarchived and unread, like an Inbox demand that re-enters |

### Conversation-state matrix

| Reading | Row | Thread header | Composer |
| --- | --- | --- | --- |
| Active | live chip, activity verb or last answer | Stop step | sends to the live session (`steering`) |
| Waiting on you (permission/question) | warning chip, the prompt | Stop step | answer form above the composer; composer still queues |
| Queued user message | chip of the step, "1 message queued" | — | queues another |
| Finished (succeeded/failed/stale) | success/danger/stale chip, last answer or error | Resume (failed/stale) | blocked note or resume note from the existing gate |
| Withdrawn / canceled by the operator | not listed unless it has messages; never unread | — | blocked |

## 5 — Messaging patterns compared

- **Linear Inbox** — flat, newest first, read on open, `e` archive / `u`
  unread, snoozes. Adopted: flatness, auto-read, the two verbs, "archived until
  it changes". Not adopted: snooze (Otomat's state machines already say when a
  thread will speak).
- **Slack Unreads / Threads** — a channel counts once no matter how many
  messages; opening marks read; a thread list with the last reply. Adopted:
  per-thread (not per-message) unread, last-message line.
- **Gmail** — archive hides until a new message; unread survives a refresh
  because it is server-side. Adopted verbatim through `inbox_marks`.
- **IDE agent panels (Cursor, VS Code Chat, Zed)** — a session list per
  window, "latest session" as default target, threads merged per workspace.
  Rejected: they are the very drift the ticket forbids (a message aimed at the
  last resumable session, threads merged across steps).

## 6 — Dependencies and limits

- **Inbox** — unchanged: demands per run, bulk marks, its own badge. Shared
  with Conversations: the `inbox_marks` table and the marks route. A pending
  permission appears in both, on purpose: the Inbox says *something needs you*;
  Conversations is where it is answered.
- **Activity Center** — unchanged: operations per run and publications, the
  state-stream pattern (`streamActivity`) is copied for the conversations
  stream, not extended. Conversations lists no publication, sync, queue slot
  or upgrade — it is not a second Activity Center.
- **Run cockpit / issue workspace** — untouched. The thread pane composes
  their components; the cockpit remains the place for the plan, the diff, the
  PR and compete selection. Conversations links there with `?step=`.
- **Notifications** — a later step can deep-link `run_awaiting_answer` and
  `permission_request` to `/conversations?run=&step=`; V1 leaves them on the
  run.
- **Hosts** — V1 reads the active host; each row still shows its host label.
  V1.1 aggregates open-tab hosts through the same `onExecutionHost` seam the
  Inbox badge uses (`useHostInboxes`) and switches host on click before
  navigating (the project tabs' `selectProject` path). A host that stops answering keeps its retained
  rows as stale.
- **Not an agent memory** — nothing infers that an agent "read" anything; marks
  are the operator's only.

## 7 — Prototype

[`prototype.html`](prototype.html) is self-contained (no network, no build):
open it in a browser. It renders seven step threads across four issues, four
runs and two hosts on the product's tokens, with the recommended layout.

What it validates, per acceptance criterion:

| Criterion | In the prototype |
| --- | --- |
| Navigation across ≥3 step conversations from several runs | 7 rows / 4 runs / 4 issues / 2 hosts; `↑` `↓` `Enter` and click |
| Last updated and unread at a glance | sorted by activity, unread dot, badge in the sidebar |
| Right recipient with step, state, configuration | thread header: issue, step, chip, runtime · model · effort, host; composer *To:* line |
| Read state persists without touching run/step state | marks in `localStorage` under `otomat.proto.conversation-marks`, keyed like `inbox_marks`; step states are fixture data the marks never edit |
| Stream, VPS, refresh, deep link, terminal | simulation bar: *Tool call* (no badge change), *Agent replies*, *Permission asked*, *Step finishes*, *Disconnect VPS*; selection in the URL hash survives reload and pasted links; finished threads block the composer with the product's note |
| Limits with Activity Center and Inbox | the sidebar keeps both entries; the header note states what this view is not |

It deliberately does not implement the filters' persistence, resizing or the
narrow layout — the product primitives already do those.

## 8 — Implementation plan

Cut after the decision; each step is a mergeable PR and none rewrites an
existing conversation surface.

1. **Domain** — `contracts/conversations.ts` (`ConversationEntry`,
   `conversationSnapshotSchema`), `projections/conversations.ts`
   (`projectConversations(evidence, marks)`,
   `countUnreadConversations`), tests for the moves table and the stale rule.
2. **DB** — `repositories/conversations.ts`: `listConversationEvidence(db, since)`
   — `step_runs` × `runs` × `issues` × `projects` in the activity scope, the
   latest non-thinking `runtime.message` per step (`json_extract(payload,
   '$.thinking')`), the pending interaction, queued/failed contribution counts,
   the latest session's `config_json`/`reported_model`. Marks through the
   existing `listInboxMarks`.
3. **Daemon API** — `api/conversations.ts` (`readConversations`),
   `routes/conversations.ts` with `GET /` and `GET /stream` (a second
   `streamSSE` loop shaped like `streamActivity`, over the new reader), mounted
   at `/api/conversations`.
   Marks keep using `POST /api/inbox/marks`. Route tests.
4. **Client** — `daemon.listConversations()`, `daemon.subscribeConversations()`.
5. **Web** — `routes/conversations.tsx` (`validateSearch` for `run`/`step`),
   `components/conversations/{view,row,list,thread-body,filters-menu}.tsx`,
   `lib/conversations/{filters,line,sections}.ts`, `api/conversations/
   {queries,use-conversations-stream}.ts`, `useMarkConversationSeen`,
   sidebar item + badge, Runs toolbar link, the §2 keyboard verbs. Tests
   mirror the Inbox ones.
6. **Docs** — codebase-map section *The Conversations Inbox*; user guide page
   under `apps/docs/guide/`; this folder stays as evidence.
7. **V1.1** — per-host aggregation and host switch on click; notification
   deep links to `/conversations`.

Sizing: 1–2 (domain + db) ≈ 1 day, 3–4 ≈ ½ day, 5 ≈ 1.5 days, 6 ≈ ½ day.
