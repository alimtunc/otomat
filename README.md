# Otomat

**Turn issues into reviewed pull requests from one agent cockpit.**

Otomat is a local-first desktop app for running coding agents against real issues.
Connect a project, choose an issue, and let Claude Code or Codex work in an isolated
git worktree. Follow the run live, steer the agent when needed, review the actual
diff, ask the agent to address your comments, and publish the result as a pull
request without stitching the workflow together across terminals and browser tabs.

## From issue to pull request

1. **Start from the work** — use a Linear issue or a local Otomat issue as the
   durable context for the task.
2. **Run the right agent** — choose the provider, model, permission mode and effort,
   or launch a reusable multi-step workflow.
3. **Keep every run isolated** — Otomat creates and tracks the branch and worktree;
   your own checkout stays untouched.
4. **Review the real change** — inspect the canonical git diff, mark files reviewed,
   leave line-level comments and send selected feedback back to an agent.
5. **Ship deliberately** — generate a conventional commit and pull request, then
   keep the issue, run, workspace and GitHub state linked throughout the lifecycle.

Runs can execute on the local machine or on a remote host while the desktop app
remains the control plane. Project data, run history and review state stay under
the user's control; Otomat coordinates the tools and subscriptions already
configured on each execution host.

## Why Otomat

- **Issue-first:** the issue remains the source of context across runs and agents.
- **Local-first:** the daemon, SQLite database, repositories and credentials stay
  on infrastructure the user controls.
- **Provider-agnostic:** agent profiles and workflows can use the supported local
  Claude Code and Codex runtimes without inventing a built-in agent.
- **Reviewable:** every result ends in a normal git diff and pull request rather
  than an opaque agent artifact.
- **Resumable:** conversations, queued instructions and lifecycle evidence survive
  navigation and daemon restarts.

Otomat is currently an alpha. The repository is a TypeScript monorepo managed with
pnpm; the sections below cover its architecture, local development and quality
gates.

## Monorepo layout

```
apps/
  web/                  React + Vite cockpit shell
  local-daemon/         Node process; backend modules live under src/:
    api/                HTTP routes + SSE
    events/             Append-only event ledger + live tailer
    git/                Worktree/branch lifecycle + canonical diff
    github/             GitHub CLI integration + PR publication
    review/             Diff snapshots, comments and fix turns
    runtime/            Codex, Claude and deterministic fake adapters
    supervisor/         Process lifecycle, reconciliation, resume and run conversations
  desktop/              Electron alpha shell: manages the daemon lifecycle, serves the web build
packages/
  domain/               Pure TS: types, state machines, event envelope, contracts
  db/                   SQLite + Drizzle + better-sqlite3, schema/migrations/repos
  client/               Typed daemon HTTP/SSE client for frontend consumers
  ui/                   Shared UI primitives and design system
  tooling/              Shared TypeScript, lint, test and boundary presets
```

Start with the standalone
[`Otomat architecture atlas`](docs/ai/otomat-visual-map.html) for the current
system topology, data flow, database, runtime traces, boundaries, technology
rationale, and “where to change what” guide.

Focused references remain available in
[`docs/ai/codebase-map.md`](docs/ai/codebase-map.md),
[`docs/ai/import-boundaries.md`](docs/ai/import-boundaries.md), and
[`docs/ai/run-lifecycle.md`](docs/ai/run-lifecycle.md).

## Getting started

```
pnpm install        # install workspace (also installs git hooks via lefthook)
pnpm build          # build every package, then run the import-boundary lint
pnpm test           # Vitest across packages
pnpm db:migrate     # create/upgrade the local SQLite database
```

## Desktop app (alpha)

The desktop shell packages Otomat as a single macOS app — no terminals. It launches the
`local-daemon` build as a child process on a free loopback port, waits for `/api/health`, then
opens the cockpit, and shuts the daemon down cleanly on quit.

```
pnpm desktop:dev       # run in dev: Vite dev server + Electron managing a spawned daemon
pnpm desktop:package   # build an unsigned macOS .app + .dmg into apps/desktop/release/
```

- Data (SQLite, runs, worktrees) lives under the app's `userData` directory, so first launch and
  relaunch share the same DB, projects, and runs. Only one daemon instance runs per app.
- CLIs you use in your shell (`git`, `gh`, `claude`, `codex`) are found even from a Finder launch:
  the app resolves your login-shell `PATH` (only `PATH` — no tokens are read).
- Repositories can be added with a native folder picker (the typed-path field still works too).
- The artifact is **unsigned** and macOS-only — Gatekeeper needs a right-click → Open on first
  launch. Auto-update, signing/notarization, and Windows/Linux builds are out of scope for the alpha.

### Dev sessions are isolated per worktree

`pnpm desktop:dev` runs the daemon it just built from the invoking checkout, and keeps everything
else that session touches to itself, so several worktrees can run at once:

- `userData` is a per-worktree root under `<appData>/Otomat Dev/<checkout>-<hash of its real path>`,
  keyed by the canonical worktree path. The SQLite database, run artifacts, generated git worktrees,
  logs, and Electron's single-instance lock all live there — never inside the checkout, and never in
  the packaged app's own `userData`, which is untouched.
- Vite is started on a port reserved for that session and pinned with `--strictPort`; Electron is
  handed that exact URL. A session never falls back to a default port, so it cannot attach to
  another worktree's dev server.

Two documented overrides, both dev-only and ignored once packaged:

| Variable | Effect |
| --- | --- |
| `OTOMAT_DESKTOP_DEV_DATA_ROOT` | Absolute path to use as the session's data root instead of the derived one — e.g. scratch data for a throwaway session. |
| `OTOMAT_DESKTOP_DEV_SERVER` | `http(s)` URL of a dev server that is already running. The runner then starts no Vite of its own and Electron loads that origin. |

The classic two-terminal flow (`pnpm dev` + `pnpm back`) is unchanged.

## Quality gates

`pnpm check` runs the full set the CI enforces on every pull request:

```
pnpm format:check   # oxfmt (import order + formatting)
pnpm lint           # oxlint
pnpm guardrails     # frontend guardrails (see AGENTS.md)
pnpm typecheck      # tsgo --noEmit across packages
pnpm build          # build + import-boundary lint
pnpm test           # Vitest across packages
```

CI (`.github/workflows/ci.yml`) runs these on pushes to `main` and on pull
requests. Dependency updates are managed by Dependabot
(`.github/dependabot.yml`).

## Toolchain

- **Type check + emit:** `tsgo` (`@typescript/native-preview`), not `tsc`.
- **Lint:** `oxlint`. **Format:** `oxfmt`. No ESLint, no Prettier.
- **Boundaries:** `scripts/import-boundaries.mjs`, a dep-free graph check (runs inside `pnpm build`).
- **Git hooks:** `lefthook`.

See [`AGENTS.md`](AGENTS.md) for the contributor and agent guide: import
boundaries, code guardrails, conventions, and scope discipline.
