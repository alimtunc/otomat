# Prerequisites

Otomat coordinates tools you already have. It ships none of them and stores none of their
credentials.

## Git

`git` on your `PATH`, with the repositories you want to work on cloned locally and able to reach
their remote without an interactive prompt. A launch
[fetches the base branch from its remote](./runs.md#a-single-run), so a remote that asks for a
password in the terminal refuses the launch in Otomat too — configure an SSH key or a credential
helper first.

## An agent runtime

At least one of:

- **Claude Code** — the `claude` CLI, signed in with your subscription or API key.
- **Codex** — the `codex` CLI, signed in.

Otomat detects the installed binaries and what each one supports (models, permission modes,
reasoning levels) by reading their own help output; nothing is assumed across versions. _Settings →
Reference → Runtimes_ shows what was detected on the active host. Upgrading a CLI is picked up on
the next launch.

Each runtime's own configuration still applies: Claude Code's settings and hooks, Codex's
`config.toml`, project and managed rules. Otomat disables none of it.

## GitHub CLI

`gh` (2.63 or newer), authenticated with `gh auth login`, is what Otomat uses to open pull
requests, publish review comments, read pull-request state and merge. Without it you can still
run agents and review diffs locally; the pull-request panel explains what is missing.

## Linear (optional)

Otomat works with local issues alone. To mirror Linear issues, create a **personal API key** in
Linear (under your account's _Security & access_ settings) and add it under _Settings → All hosts →
Integrations_. The key is stored as described under
[Credentials](./data-and-security.md#credentials). Mapping a project to a Linear team happens per
project — see [Add a project](./projects.md#connect-linear).

## Project readiness

_Settings → Project → This project_ has a **Run health check** that probes every input a launch
reads on the host that owns the project: repository path, remote and base branch, worktrees root,
GitHub, Linear, runtimes, agent profiles and their skills. Each check names the one action that
clears it. It installs, connects and repairs nothing.
