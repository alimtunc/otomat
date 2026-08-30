# Otomat — UX/UI implementation prompt

You are working in the Otomat monorepo (pnpm workspaces: `packages/ui`, `packages/domain`, `apps/web`, `apps/local-daemon`, `apps/desktop`). Implement the UX/UI changes below **without changing product behavior**: same routes, same daemon contracts, same keyboard shortcuts, same data. This is a presentation + information-architecture pass grounded in an audit of screenshots and source.

Non-negotiable invariants:
- All status colors flow through `packages/ui/src/lib/status/registry.ts` + `tone.ts`. Never hard-code a status color in a component.
- All spacing/color/type through tokens in `packages/ui/src/styles/tokens.css`.
- No informational text below 11px. Text at or below 12px must use a color with ≥4.5:1 contrast on its surface.
- Keep `pnpm check` green after each batch; add gallery entries (`apps/web/src/gallery`) for every new/changed shared component.
- Existing tests must pass unmodified unless the test asserts presentation you are explicitly changing.

Work in three batches, one PR each, in order.

---

## Batch 1 — State colors & number language (foundation)

### 1.1 `--live` tone
`tokens.css`: add to dark theme `--live: #4da3ff; --live-bg: rgba(77,163,255,.13);` plus light-theme equivalents (pick a 4.5:1-compliant blue on white, e.g. `#1d6fd8` / `rgba(29,111,216,.10)`) and entries under the `brass`/`viridian` direction overrides (keep them in the blue family; direction identities only shift warmth).

`packages/ui/src/lib/tone.ts`: add tone `live` with text/bg/solid facets like the existing tones.

`packages/ui/src/lib/status/registry.ts`: remap **motion states only** from `iris` to `live`:
- run: `preparing`, `running`
- step: `starting`, `running`
- operation: `running`
- contribution/compete motion states (`sending`, `promoting`, and any other in-flight state currently `iris`)

Leave `iris` on: issue `ready`, selection/focus, anything meaning "actionable by you" rather than "machine in motion".

`apps/web/src/lib/workspace/state.ts`: workspace `active` → tone `live` (label unchanged).

`LiveDot`: accept tone `live`; sidebar "Runs" live indicator and cockpit step dots use it.

### 1.2 Number formatting
`apps/web/src/lib/run/usage.ts` (single module, exported to all call sites):
- `formatTokenCount(n)`: tiered — `<10k → "9.4k"`, `<10M → "4.2M"`, else `"5.35B"`; ≤4 significant characters + unit. Always set the exact integer with thousands separators in a `title` attr at the call site.
- `formatCostUsd(n)`: `$#,##0.00` (fr-agnostic: use `Intl.NumberFormat("en-US")`).
- Replace the "everything in k" formatter. Call sites: usage summary tiles, usage table cells (tokens/cost), cockpit steps pane usage line, run-context facts, PR summary, report page.
- `PARTIAL` caps tag → a small info glyph + tooltip/adjacent sentence: "N runs did not report cost". Provide a tiny shared `PartialMarker` component.
- Remove `FINAL` entirely — final is the default; only live-updating totals get a subtle "counting…" marker while the run is in motion.
- Usage table Tokens cell: one line `33.4M in · 191k out` (kill the 2×2 grid); right-align Tokens/Cost/Duration columns and their headers.

### 1.3 Readability floor
- Replace `text-[9px]`/`text-[10px]` in `apps/web/src/components/runs/**` with ≥11px equivalents (step meta line, session status, tags).
- `tokens.css`: raise `--text-tertiary` to ≥4.5:1 on `--background` (target ≈ `#7a8291`; verify with a contrast checker in both themes).

### Acceptance (Batch 1)
- `rg "text-\[(9|10)px\]" apps/web/src/components/runs` → no matches.
- No running/active state renders in the `#f0645a`–`#f2545b` band anywhere (gallery screenshot pass).
- Every token count in the UI is ≤4 significant chars + unit, exact value on hover; costs 2 decimals with separators.
- Registry snapshot test asserting tone per state; formatter table tests.

---

## Batch 2 — Terminal states & next action (run surfaces)

### 2.1 Next-action resolver
New `apps/web/src/lib/run/next-action.ts`: pure function `resolveNextAction(run: RunDetail, pr?: PullRequestInfo, review?: ReviewInfo): NextAction | null` where `NextAction = { kind, label, description, href | onActionId, tone }`. Mapping (unit-test every `RunState`):
- `awaiting_permission` → "Answer the permission request" (deep-link to the interaction card), tone warning
- `awaiting_human` / `awaiting_selection` / `waiting_for_provider` → corresponding answer/choose/wait actions
- `review_ready` → "Review the diff", tone review
- `completed` + PR unpublished → "Publish the pull request"
- `completed` + PR open → "Open PR #N" (external), tone success
- `completed` + PR merged → null next action + `outcome: merged`
- `failed` → "Open the failing step" (last failed step), tone danger; `canceled` → null + outcome
- `running`/`preparing`/`queued` → "Follow live", tone live

### 2.2 Surfaces driven by the resolver
- **Cockpit next-action strip**: 40px row under the page header (all tabs), icon + one sentence (`<b>Run completed.</b> PR #183 is merged — nothing left to do here.`) + at most one default button and one ghost secondary. Slides in 200ms ease-out on state change; never pulses.
- **Run-context rail**: lead card = outcome/next-action (replaces the button row as the first element); facts card below with humanized values (tokens via Batch 1 formatters, cost separate row, drop `FINAL`).
- **Composer**: on terminal runs (`completed/failed/canceled`), replace the entire composer (textarea + send) with a one-line closure bar: state glyph + "This run is finished — its sessions are closed." + "Add follow-up step" button. No enabled-looking coral send button on dead sessions.
- **Runs list**: waiting rows get an inline action chip in a trailing column ("Answer", "Choose winner", "Review diff"); running rows get "Follow live". Row content column shows step summary ("Plan + Implement ✓ · Review ✓ · 2 steps" or "step 1 of 2 · 34 min"); add Tokens·cost column (from the run detail cache if the list endpoint lacks aggregates — do not add daemon endpoints in this batch). Issue group header gains a right-aligned PR/outcome hint when one exists ("PR #183 merged").

### 2.3 PR tab is state-driven
`apps/web/src/components/runs/pr/view.tsx`: branch on publication state.
- **Terminal (PR merged or closed)**: render an `OutcomeCard` — big icon + "Pull request #183" + status chip; line `feat/project-tabs → main · merged 1 day ago · alimtunc`; buttons "Open on GitHub" + ghost "View diff"; fact grid limited to facts that survive worktree cleanup (changes at publication, steps, usage, metadata author). Below: a Linear-consequence strip ("OTO-139 moved to Done. Status sync ran on merge.") when sync is configured; a collapsed read-only "Publication details" disclosure containing the frozen type/scope/summary/description/branch; a muted one-liner reframing cleanup: "Workspace cleaned after merge — the run's worktree was removed, so there is no local diff to show." **No editable fields, no AI-generate button, no disabled primary, no danger tone.** Merged uses the review/purple tone.
- **Pre-publish**: keep today's form and behavior exactly; only inherit Batch 1 tone/format fixes.
- **Publishing in flight**: keep the stepper, but only render it while publishing or on failure (with the failing step marked) — not on terminal success.

### 2.4 Report tab de-noise
One "Deterministic projection — every fact below is ledger evidence" explainer at the top; per-card `EVIDENCE` chips become a subtle shared tag or disappear; hero states the outcome once (chip only).

### Acceptance (Batch 2)
For each state in {completed+merged, completed+open PR, completed+unpublished, review_ready, failed, canceled, awaiting_permission, running}: exactly one primary next action across cockpit strip + rail + PR tab; terminal PR tab has zero editable fields and zero danger tone; composer absent on terminal runs; pre-publish flow byte-identical in behavior. Snapshot the three surfaces per state using the deterministic fake runtime adapter.

---

## Batch 3 — Chrome merge, multi-project attention, list grammar

### 3.1 PageBar (shell)
Merge topbar + page header into one 48px `PageBar` in `packages/ui`, wired in `route-shell.tsx`:
- Left: back button (when applicable) + breadcrumb/title + status chips (RunIdentity).
- Center: view tabs when the route has them (cockpit segmented control).
- Right: contextual actions + activity bell + connection status.
- Remove the topbar project label and the 230px search field (sidebar Search + `⌘K` remain the entry points; keyboard behavior unchanged).
- Breadcrumb truncates before actions do; below `lg`, tabs keep labels and drop icons (never icon-only).

### 3.2 Multi-project attention (see boards 2a/2b)
- Promote the OTO-139 project tab strip to the default shell (remove its opt-in flag if one exists). Tabs: glyph + name; a **blue dot** when the project has a running run; an **amber count badge** = that project's actionable Inbox entries. Badge updates live from the existing inbox projection; resolving the entry decrements it immediately.
- Project identity appears once in the chrome (the active tab). The sidebar switcher row simplifies to project name + path + chevrons (host tag lives on the tab strip's right edge: `host supervps`).
- Settings becomes a pinned sidebar footer item above the daemon status line.
- Sidebar Inbox badge shows the cross-project actionable count (amber when >0).

### 3.3 Inbox + Reviews share one row grammar
New shared `InboxRow` + `InboxGroup` (web, `components/attention/`): `[kind chip 150px] [id + title + — reason] [time] [single action button]`, 44px rows, groups with a small header (project glyph for Inbox, need-kind for Reviews). Reviews groups: "Needs your review" → action "Review diff"; "Changes requested" → "Fix N comments"; "Waiting on checks" → "Open run". Checks render as a chip (✓ checks / running / failed), never prose. Inbox groups by project, one "nothing waits on you" line for quiet projects. Sync control: "synced Xm ago" text + "Sync now" button, unchanged behavior.

### 3.4 Workspaces (settings)
- One-line 40px rows: `[state chip 128px] [issue id + title] [branch (path in title attr)] [git clean/dirty dot+word] [PR #] [updated] [hover actions: open, delete]`.
- The per-row state sentence moves to a tooltip on the state chip (`StatusChip` gains an optional `hint` prop in `packages/ui`).
- Above the table: when `cleanup_required > 0`, a success-toned strip "N worktrees have merged pull requests and are safe to delete" with a "Clean up N" button → confirm dialog listing exact branches → loops the existing per-workspace delete; per-row progress; inline receipt "N deleted · M failed" (not a toast). Only `cleanup_required` rows are ever bulk-deleted.
- Zero-count state chips collapse into "+N empty states".
- Merge the three stacked control rows (counters / search / reconcile) into one toolbar row.
- "Active" chips are `live` blue (Batch 1) so the table stops reading as an alert wall.

### 3.5 Settings pages button discipline
One primary per card, enabled only when dirty; other actions default/ghost variants. Sweep `components/settings/**`.

### Acceptance (Batch 3)
- ≤2 fixed bars above content on list views (was up to 5); Settings reachable in one click everywhere; project identity rendered once.
- Inbox and Reviews render through the same row/group components (import check).
- Workspace rows single-line at 1280px; sentences on hover; bulk delete touches only cleanup_required.
- Tab badges: creating/resolving an inbox entry updates the project badge without navigation.
- Keyboard smoke: `⌘K`, `C`, `[`, `Ctrl+Tab` project cycling, cockpit tab shortcuts all unchanged.
- 1180px pass: PageBar truncates breadcrumb, tabs keep labels, no horizontal scroll.

---

## Visual reference
The redesign boards in the audit project are the source of truth for layout and tone: shell+runs (1a), cockpit (1b), PR terminal (1c), usage (1d), issue detail (1e), workspaces (1f), multi-project shell + Inbox (2a), Reviews (2b). Issue-detail changes (launcher row above the fold, clamped spec, single status control with sync consequence, quiet PR-attach row) ride along in Batch 3 if capacity allows; otherwise they are the first follow-up.

## Engineering follow-ups (after Batch 3, no design dependency)
- **Virtualize long lists**: conversation thread and logs render the full ledger DOM (`rg virtual apps/web/src` → nothing). Adopt `@tanstack/react-virtual` for `runs/logs/list.tsx` and the conversation thread; keep "Load earlier activity" as the fetch boundary.
- **Attention never arrives as a toast**: `shell/activity/use-notices.ts` maps attention buckets to `toast.success/error`. Rule: toasts confirm actions the user just took; anything that *waits on the user* goes to Inbox + tab badges only. Remove attention-bucket toasts once badges land (3.2).
- **One feedback contract in Settings**: forms currently mix toasts (`init-commands-form`, `use-form.ts` files) and inline `role="status"` receipts. Standardize: inline receipt for local forms, toast only for effects on another page. Normalize copy to sentence case without trailing periods on successes.
- **Announce run state changes**: give the Batch 2 next-action strip `aria-live="polite"` so completed/review_ready/awaiting transitions are read by screen readers (chips alone are silent today).
- **Audit the lone poll**: `use-host-projects.ts` refetches every 15s while everything else rides the activity stream — either the stream covers host projects (drop the poll) or document why it can't.

## Out of scope
Diff review workbench, compete/selection view, launch dialogs, light-theme polish beyond token compliance, any daemon API changes.
