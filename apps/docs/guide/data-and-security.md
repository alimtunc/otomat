# Data, privacy and security

Otomat is local-first: everything it knows lives on machines you control, and it phones nowhere.

## What is stored, and where

`~/Library/Application Support/Otomat` is the data directory of the release build:

| Path         | Content                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| `otomat.db`  | The SQLite database: projects, issues, runs, steps, sessions, comments, pull-request mirrors, settings. |
| `runs/`      | Each run's event ledger and provider output.                                                            |
| `worktrees/` | The git worktrees agents work in.                                                                       |
| `backups/`   | Database backups taken before every schema migration.                                                   |
| `logs/`      | Rotating, redacted logs of the desktop shell and the daemon.                                            |

A remote host keeps its own data on the server (see the
[remote execution host reference](https://github.com/alimtunc/otomat/blob/main/docs/ai/remote-execution-host.md));
the desktop app keeps nothing of it locally except the SSH alias.

Nothing is installed outside the app bundle (see [Install](./install.md#install)).

## Backups

- Before applying a database migration, Otomat writes a consistent copy of the database into
  `backups/` and refuses to continue when it cannot. A failed migration keeps the original
  database and names the backup; the startup screen offers **Restore Backup**.
- A remote daemon upgrade backs up its database the same way, under the deployment's `backups/`
  directory, before swapping the build.
- Nothing prunes these backups. To back up Otomat yourself, quit the app and copy the data
  directory; the git worktrees are reconstructible from your repositories, the database is not.
- Otomat refuses to open a data directory written by a newer version rather than migrating
  downward. Rolling the app back across a schema change means restoring the matching backup.

The **Data Safety** menu shows the retention policy: archived worktrees and large run artifacts
stay on disk until you remove them yourself.

## Credentials

Otomat holds no credential of its own and asks for none:

- **Agent runtimes** authenticate through their own CLIs (`claude`, `codex`). Otomat never reads
  their tokens.
- **GitHub** goes through the authenticated `gh` CLI.
- **Git remotes** use your existing SSH keys or credential helper; a remote that prompts is refused
  rather than answered.
- **Linear** personal API keys are the exception: you enter them once, the desktop app stores them
  encrypted with the operating system's key store and hands them to each daemon in memory. They
  are never written to the database, a log or a support bundle.
- **Remote hosts** are reached through the system `ssh` and a `Host` alias you configured; Otomat
  stores the alias string only.

## Network

- The daemon listens on the **loopback interface only** and rejects requests whose `Host` header
  is not loopback. A remote daemon is reached through an SSH tunnel to the server's loopback; no
  port is opened on the network.
- Outbound connections are the ones the tools you configured make: the provider CLIs to their
  APIs, `gh` to GitHub, Linear's API when a workspace is connected, `git` to your remotes, and
  GitHub Releases for the app's own update check.
- There is **no telemetry**, no crash reporting and no analytics. Nothing leaves your machine
  unless you export it.

## What agents can reach

An agent runs as your user, in a git worktree, with the permission mode and sandbox chosen at
launch. It can do what that runtime lets it do — Otomat adds no sandbox of its own, and it never
widens a mode behind your back (see
[Questions and permissions](./steering.md#questions-and-permissions)).

The context an agent receives is composed from references: the issue's mirrored fields, the files
you attached, the run's own history. Repository files are read from a captured git tree, never
through the filesystem, so a symlink pointing outside the worktree is refused rather than followed.
Every session records what it was given; **Working context** in the conversation shows it.

Agents receive no tracker URL, no external identifier and no credential in their prompt.

## Logs and support bundles

Every log line is passed through one redactor — provider, GitHub and Linear token shapes,
authorization headers, credential and prompt fields — before it is written, and again before it
is exported. A support bundle
(**Data Safety → Export Support Bundle…**) contains the app and daemon versions, the build commit
and channel, the daemon's health, the schema state, the redacted logs and, when exported from an
error, that error's details. It contains no database rows, no run output, no repository content
and no credential; review it before sharing it.

## Reporting a security issue

Please report vulnerabilities privately through the repository's **Security** tab on GitHub
rather than in a public issue.
